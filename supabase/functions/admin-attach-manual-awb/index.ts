// Admin-only: attach an AWB that was created manually on a courier portal to
// an existing (usually stuck / PAYMENT_RECEIVED) booking, so tracking, label
// download and cancellation all work through the normal partner plumbing.
//
// Input: { booking_id, partner, awb, partner_order_id?, label_url?, note? }
// partner ∈ delhivery | urbanebolt | xpressbees | shadowfax | shree_maruti
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const ALLOWED_ROLES = new Set(["super_admin", "operations", "support"]);

const PARTNERS: Record<string, string> = {
  delhivery: "Delhivery",
  urbanebolt: "UrbaneBolt",
  xpressbees: "XpressBees",
  shadowfax: "Shadowfax",
  shree_maruti: "Shree Maruti",
};

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

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: adminRow } = await admin
      .from("admin_users")
      .select("role,is_active,email")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminRow?.is_active || !ALLOWED_ROLES.has(adminRow.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "").trim();
    const partner = String(body?.partner || "").trim().toLowerCase();
    const awb = String(body?.awb || "").trim();
    const partnerOrderId = body?.partner_order_id ? String(body.partner_order_id).trim() : null;
    const labelUrl = body?.label_url ? String(body.label_url).trim() : null;
    const note = body?.note ? String(body.note).trim().slice(0, 500) : null;

    if (!bookingId) return json({ error: "booking_id is required" }, 400);
    if (!PARTNERS[partner]) {
      return json({ error: `partner must be one of: ${Object.keys(PARTNERS).join(", ")}` }, 400);
    }
    if (!awb || awb.length < 4 || awb.length > 64) {
      return json({ error: "awb must be between 4 and 64 characters" }, 400);
    }
    if (labelUrl && !/^https?:\/\//i.test(labelUrl)) {
      return json({ error: "label_url must be a valid http(s) URL" }, 400);
    }

    const { data: row } = await admin
      .from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!row) return json({ error: "Booking not found" }, 404);
    if (row.prayog_awb || row.tracking_id) {
      return json({
        error: `This booking already has AWB ${row.prayog_awb || row.tracking_id}`,
      }, 409);
    }

    const { data: updated, error: updErr } = await admin.from("bookings").update({
      status: "CREATED",
      prayog_awb: awb,
      tracking_id: awb,
      prayog_order_id: partnerOrderId || row.prayog_order_id || awb,
      label_url: labelUrl || row.label_url,
      partner_id: `${partner}_direct`,
      booking_source: `manual_${partner}`,
      courier_name: row.courier_name || PARTNERS[partner],
      failure_reason: null,
      failure_step: null,
      partner_error_raw: [
        `Manual AWB added by ${adminRow.email} at ${new Date().toISOString()}`,
        note ? `Note: ${note}` : null,
      ].filter(Boolean).join(" | ").slice(0, 2000),
    }).eq("id", bookingId).select().single();

    if (updErr) {
      console.error("[admin-attach-manual-awb] update failed:", updErr);
      return json({ error: updErr.message }, 500);
    }

    console.log(`[admin-attach-manual-awb] ${bookingId} → ${partner} ${awb} by ${adminRow.email}`);
    return json({ success: true, booking: updated });
  } catch (err) {
    console.error("[admin-attach-manual-awb] error:", err);
    return json({ error: "Internal server error", details: String(err) }, 500);
  }
});
