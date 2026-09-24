// Admin-triggered: refresh the Razorpay payment status of an assisted
// (PENDING_PAYMENT) booking, and — if paid — automatically fire the correct
// shared shipment function so each parcel lands at CREATED with its own AWB.
//
// Input:  { booking_id: string, manual_payment_id?: string }
// Output: { paid, booked, awb_number?, tracking_id?, label_url?, error?, link_status? }
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
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
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
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("role,is_active")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminRow?.is_active || !ALLOWED_ROLES.has(adminRow.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Body ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "");
    const manualPaymentId = body?.manual_payment_id
      ? String(body.manual_payment_id).trim()
      : null;
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "booking_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: row, error: rowErr } = await admin
      .from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: already booked
    if (row.status && row.status !== "PENDING_PAYMENT" && row.prayog_awb) {
      return new Response(JSON.stringify({
        paid: true, booked: true,
        awb_number: row.prayog_awb, tracking_id: row.tracking_id, label_url: row.label_url,
        already: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Razorpay lookup ───────────────────────────────────────────
    const env = getEnvironmentFromRequest(req);
    const rz = getRazorpayConfig(env);
    if (!rz.keyId || !rz.keySecret) {
      return new Response(JSON.stringify({ error: `Razorpay not configured for ${env}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const basic = btoa(`${rz.keyId}:${rz.keySecret}`);
    const rzHeaders = { Authorization: `Basic ${basic}` };

    let paymentId: string | null = null;
    let linkStatus: string | null = null;
    let paidAmountPaise: number | null = null;

    if (manualPaymentId) {
      // Manual override — fetch payment directly.
      const pRes = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(manualPaymentId)}`,
        { headers: rzHeaders },
      );
      const pText = await pRes.text();
      if (!pRes.ok) {
        return new Response(JSON.stringify({
          paid: false, error: "Razorpay payment lookup failed", details: pText,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pJson = JSON.parse(pText);
      if (pJson?.status !== "captured") {
        return new Response(JSON.stringify({
          paid: false, error: `Payment status is '${pJson?.status}', not captured`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      paymentId = pJson.id;
      paidAmountPaise = Number(pJson.amount) || null;
      linkStatus = "paid_manual";
    } else if (row.payment_link_id) {
      const lRes = await fetch(
        `https://api.razorpay.com/v1/payment_links/${encodeURIComponent(row.payment_link_id)}`,
        { headers: rzHeaders },
      );
      const lText = await lRes.text();
      if (!lRes.ok) {
        return new Response(JSON.stringify({
          paid: false, error: "Razorpay payment link lookup failed", details: lText,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const lJson = JSON.parse(lText);
      linkStatus = lJson?.status || null;
      if (lJson?.status === "paid") {
        // Find captured payment in payments array.
        const payments = Array.isArray(lJson?.payments) ? lJson.payments : [];
        const captured = payments.find((p: any) =>
          p?.status === "captured" || p?.status === "paid"
        );
        if (captured?.payment_id) {
          paymentId = captured.payment_id;
          paidAmountPaise = Number(captured.amount) || null;
        }
      }
      if (!paymentId) {
        // Not paid (or paid but payment_id missing from list) → surface status.
        await admin.from("bookings")
          .update({ payment_link_status: linkStatus || row.payment_link_status })
          .eq("id", bookingId);
        return new Response(JSON.stringify({
          paid: false, link_status: linkStatus,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      return new Response(JSON.stringify({
        error: "Booking has no payment_link_id and no manual_payment_id was provided",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sanity: amount should match the booking total (within 1 rupee).
    if (paidAmountPaise && row.courier_price) {
      const expected = Math.round(Number(row.courier_price) * 100);
      if (Math.abs(paidAmountPaise - expected) > 100) {
        console.warn(
          "[admin-finalize] amount mismatch",
          { paidAmountPaise, expected, booking_id: bookingId },
        );
      }
    }

    // ── Mark PAYMENT_RECEIVED ─────────────────────────────────────
    await admin.from("bookings").update({
      payment_id: paymentId,
      payment_status: "paid",
      status: "PAYMENT_RECEIVED",
      payment_link_status: "paid",
    }).eq("id", bookingId);

    // Use the same shipment engine as customer bookings. It atomically claims
    // the booking, resumes unfinished boxes without duplicating successful
    // ones, creates one AWB/label per box, and handles full/partial refunds.
    const shipmentRes = await fetch(`${supabaseUrl}/functions/v1/create-consumer-shipment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "x-environment": env,
      },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    const shipmentText = await shipmentRes.text();
    let shipment: any;
    try { shipment = JSON.parse(shipmentText); } catch { shipment = { error: shipmentText }; }

    if (!shipmentRes.ok) {
      return new Response(JSON.stringify({
        paid: true,
        booked: false,
        error: shipment?.error || "Courier booking failed",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      paid: true,
      ...shipment,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[admin-finalize-assisted-booking] error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
