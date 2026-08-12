// Admin-only: create an assisted booking WITHOUT collecting payment through
// ViaSetu. Used when the customer already paid elsewhere (e.g. another partner
// that could not fulfil), or when the amount is settled offline.
//
// The row is recorded as payment_status = 'external_settled' so it never counts
// as ViaSetu-collected cash, and is tagged with the admin, reason and note.
//
// Input: { customer_user_id, customer_name?, customer_phone, booking_draft,
//          reason, note?, manifest_now?: boolean }
// Output: { success, booking_id, manifested, awb?, error? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const ALLOWED_ROLES = new Set(["super_admin", "operations", "support"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const adminAuthId = userData.user.id;
    const adminEmail = userData.user.email || "";

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("role,is_active")
      .eq("user_id", adminAuthId)
      .maybeSingle();
    if (!adminRow?.is_active || !ALLOWED_ROLES.has(adminRow.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      customer_user_id,
      customer_phone,
      booking_draft: draft,
      reason,
      note,
      manifest_now,
    } = body || {};

    if (!customer_user_id || !draft) {
      return json({ error: "customer_user_id and booking_draft are required" }, 400);
    }
    const reasonText = String(reason || "").trim();
    if (!reasonText) return json({ error: "reason is required" }, 400);
    const noteText = note ? String(note).trim().slice(0, 500) : null;

    const audit = [
      `No-payment booking by ${adminEmail} at ${new Date().toISOString()}`,
      `Reason: ${reasonText}`,
      noteText ? `Note: ${noteText}` : null,
    ].filter(Boolean).join(" | ").slice(0, 2000);

    const row = {
      user_id: customer_user_id,
      status: "PAYMENT_RECEIVED",
      payment_status: "external_settled",
      is_admin_assisted: true,
      created_by_admin_id: adminAuthId,
      created_by_admin_email: adminEmail,
      booking_source: "admin_assisted_unpaid",
      partner_error_raw: audit,
      // sender
      sender_name: draft.sender_name ?? "",
      sender_phone: draft.sender_phone ?? String(customer_phone || ""),
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
      gst: draft.gst ?? 0,
      courier_rate: draft.courier_rate ?? null,
      retail_price: draft.retail_price ?? null,
      margin_amount: draft.margin_amount ?? null,
      account_type: draft.account_type ?? "consumer",
      partner_id: draft.partner_id ?? null,
      service_code: draft.service_code ?? null,
    };

    const { data: inserted, error: insErr } = await admin
      .from("bookings")
      .insert(row)
      .select("id")
      .single();
    if (insErr) {
      console.error("[admin-create-unpaid-booking] insert error", insErr);
      return json({ error: insErr.message }, 500);
    }

    // Optionally manifest with the courier straight away (server-side, so the
    // admin's tab can close safely).
    let manifested = false;
    let awb: string | null = null;
    let manifestError: string | null = null;

    if (manifest_now) {
      try {
        const env = req.headers.get("x-environment") || "production";
        const res = await fetch(`${supabaseUrl}/functions/v1/create-consumer-shipment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-key": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "x-environment": env,
          },
          body: JSON.stringify({ booking_id: inserted.id, skip_refund: true }),
        });
        const payload = await res.json().catch(() => ({}));
        awb = payload?.awb_number || payload?.awb || payload?.tracking_id || null;
        manifested = Boolean(payload?.success && awb);
        if (!manifested) manifestError = payload?.error || "Courier booking did not return an AWB";
      } catch (e) {
        manifestError = String(e);
      }
      if (!manifested) {
        console.error("[admin-create-unpaid-booking] manifest failed", manifestError);
      }
    }

    console.log(
      `[admin-create-unpaid-booking] ${inserted.id} by ${adminEmail} · manifest=${manifest_now ? manifested : "skipped"}`,
    );

    return json({
      success: true,
      booking_id: inserted.id,
      manifested,
      awb,
      manifest_error: manifestError,
    });
  } catch (err) {
    console.error("[admin-create-unpaid-booking] error", err);
    return json({ error: String(err) }, 500);
  }
});
