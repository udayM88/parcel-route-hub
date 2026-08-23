// Admin-only: create a Razorpay Payment Link and record a PENDING_PAYMENT
// booking row on the customer's account. The customer receives an SMS from
// Razorpay with the payment link; on successful payment Razorpay's webhook
// (or the customer-side verify flow) flips the row to PAYMENT_RECEIVED and
// the normal courier-booking follow-through runs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const ALLOWED_ROLES = new Set(["super_admin", "operations", "support"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Admin auth ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminAuthId = userData.user.id;
    const adminEmail = userData.user.email || "";

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("role,is_active")
      .eq("user_id", adminAuthId)
      .maybeSingle();
    if (!adminRow?.is_active || !ALLOWED_ROLES.has(adminRow.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Body ──────────────────────────────────────────────────────
    const body = await req.json();
    const {
      customer_user_id,
      customer_name,
      customer_phone,
      total_amount,
      description,
      booking_draft,
    } = body || {};

    if (!customer_user_id || !customer_phone || !total_amount || !booking_draft) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountPaise = Math.round(Number(total_amount) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Razorpay Payment Link ─────────────────────────────────────
    const env = getEnvironmentFromRequest(req);
    const rz = getRazorpayConfig(env);
    if (!rz.keyId || !rz.keySecret) {
      return new Response(JSON.stringify({ error: `Razorpay not configured for ${env}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const referenceId = `AA${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const phoneDigits = String(customer_phone).replace(/\D/g, "").slice(-10);
    const contact = `+91${phoneDigits}`;

    const rzPayload = {
      amount: amountPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: referenceId,
      description: (description || "ViaSetu courier booking").slice(0, 2048),
      customer: {
        name: customer_name || "Customer",
        contact,
      },
      notify: { sms: true, email: false },
      reminder_enable: true,
      notes: {
        source: "admin_assisted",
        admin_email: adminEmail,
        customer_user_id: String(customer_user_id),
      },
    };

    const basic = btoa(`${rz.keyId}:${rz.keySecret}`);
    const rzRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify(rzPayload),
    });
    const rzText = await rzRes.text();
    if (!rzRes.ok) {
      console.error("[admin-create-payment-link] Razorpay error", rzRes.status, rzText);
      return new Response(
        JSON.stringify({ error: "Razorpay payment link creation failed", details: rzText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const rzJson = JSON.parse(rzText);

    // ── Persist a PENDING_PAYMENT booking row on the customer's account ──
    const draft = booking_draft;
    const row = {
      user_id: customer_user_id,
      status: "PENDING_PAYMENT",
      payment_status: "pending",
      payment_link_id: rzJson.id,
      payment_link_url: rzJson.short_url,
      payment_link_status: rzJson.status || "created",
      is_admin_assisted: true,
      created_by_admin_id: adminAuthId,
      created_by_admin_email: adminEmail,
      // sender
      sender_name: draft.sender_name ?? "",
      sender_phone: draft.sender_phone ?? "",
      sender_address: draft.sender_address ?? "",
      sender_city: draft.sender_city ?? "",
      sender_state: draft.sender_state ?? "",
      sender_pincode: draft.sender_pincode ?? "",
      // receiver
      receiver_name: draft.receiver_name ?? "",
      receiver_phone: draft.receiver_phone ?? "",
      receiver_address: draft.receiver_address ?? "",
      receiver_city: draft.receiver_city ?? "",
      receiver_state: draft.receiver_state ?? "",
      receiver_pincode: draft.receiver_pincode ?? "",
      // package
      goods_type: draft.goods_type ?? "Package",
      package_weight: String(draft.package_weight ?? "1"),
      length: draft.length != null ? String(draft.length) : null,
      width: draft.width != null ? String(draft.width) : null,
      height: draft.height != null ? String(draft.height) : null,
      shipment_value: draft.shipment_value ?? null,
      urgency: draft.urgency ?? "standard",
      // courier + financials
      courier_name: draft.courier_name ?? "",
      courier_price: draft.courier_price ?? 0,
      delivery_time: draft.delivery_time ?? "Standard",
      base_fare: draft.base_fare ?? 0,
      platform_fee: draft.platform_fee ?? 0,
      consumer_platform_fee: draft.consumer_platform_fee ?? 0,
      gst: draft.gst ?? 0,
      partner_id: draft.partner_id ?? null,
      service_code: draft.service_code ?? null,
      booking_source: "admin_assisted_pending",
    };

    const { data: inserted, error: insErr } = await admin
      .from("bookings")
      .insert(row)
      .select("id")
      .single();
    if (insErr) {
      console.error("[admin-create-payment-link] insert error", insErr);
      return new Response(
        JSON.stringify({ error: insErr.message, payment_link: rzJson }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: inserted.id,
        payment_link_id: rzJson.id,
        payment_link_url: rzJson.short_url,
        reference_id: referenceId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[admin-create-payment-link] error", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
