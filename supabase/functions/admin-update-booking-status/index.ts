// Admin manual status override for an ongoing shipment.
// Only super_admin / operations may use it. Cancellation is NOT handled here —
// it must go through the existing cancel flow so partner cancel + refund run.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { recordCourierStatus } from "../_shared/status-sync.ts";
import { resolvePartnerKey } from "../_shared/partner-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Allowed manual statuses -> booking.status value stored.
export const MANUAL_STATUSES = [
  "CONFIRMED", "PICKED_UP", "IN_TRANSIT", "DELAYED", "OUT_FOR_DELIVERY", "DELIVERED", "RTO",
] as const;
const LOCKED = ["CANCELLED", "CANCELED", "FAILED", "PAYMENT_ABANDONED", "PENDING_PAYMENT"];

const Body = z.object({
  booking_id: z.string().uuid(),
  status: z.enum(MANUAL_STATUSES),
  reason: z.string().trim().min(3).max(500),
  notify_customer: z.boolean().optional().default(true),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (cErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(URL_, SERVICE);
    const { data: adminRow } = await admin.from("admin_users")
      .select("id, role, email").eq("user_id", claims.claims.sub).eq("is_active", true).maybeSingle();
    if (!adminRow || !["super_admin", "operations"].includes(adminRow.role)) {
      return json({ error: "Only super admins and operations staff can change shipment status" }, 403);
    }

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { booking_id, status, reason, notify_customer } = parsed.data;

    const { data: booking } = await admin.from("bookings").select("*").eq("id", booking_id).maybeSingle();
    if (!booking) return json({ error: "Booking not found" }, 404);
    const current = String(booking.status || "").toUpperCase();
    if (LOCKED.includes(current)) {
      return json({ error: `Status ${current} cannot be changed manually` }, 409);
    }
    if (current === status) return json({ error: "Booking already has this status" }, 409);

    const { error: upErr } = await admin.from("bookings")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", booking_id);
    if (upErr) return json({ error: upErr.message }, 500);

    const partnerKey = resolvePartnerKey(booking.partner_id, `${booking.booking_source || ""} ${booking.courier_name || ""}`);
    let audit: unknown = null;
    if (notify_customer) {
      audit = await recordCourierStatus(admin, { ...booking, status }, {
        status: status.replace(/_/g, " "),
        timestamp: new Date().toISOString(),
        manual: true, admin_email: adminRow.email, reason, previous_status: booking.status,
      }, { source: "admin_manual", partnerKey });
    } else {
      // Audit only, no SMS.
      await admin.from("shipment_status_events").insert({
        booking_id, awb: booking.prayog_awb || booking.tracking_id || "",
        courier_name: booking.courier_name, partner_key: partnerKey,
        raw_status: status, raw_payload: { manual: true, admin_email: adminRow.email, reason, previous_status: booking.status },
        normalized_status: status === "RTO" ? "RETURNED" : status === "PICKED_UP" ? "IN_TRANSIT" : status,
        previous_status: booking.status, event_time: new Date().toISOString(), source: "admin_manual",
        dedupe_key: `manual:${booking_id}:${status}:${Date.now()}`,
      });
    }
    console.log(`[admin-status] ${adminRow.email} ${booking_id} ${booking.status} -> ${status} | ${reason}`);
    return json({ success: true, previous: booking.status, status, audit });
  } catch (e) {
    console.error("[admin-status] error", e);
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
