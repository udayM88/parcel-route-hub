import { dispatchEmail } from "../_shared/notify-email.ts";
// Bulk-refresh tracking + status for active bookings (admin or cron/service-role).
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolvePartnerKey } from "../_shared/partner-key.ts";
import { refundBookingIfPaid } from "../_shared/refund.ts";
import { recordCourierStatus } from "../_shared/status-sync.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-environment",
};

const PARTNER_FN: Record<string, string> = {
  shadowfax: "shadowfax-tracking",
  delhivery: "delhivery-tracking",
  urbanebolt: "urbanebolt-tracking",
  xpressbees: "xpressbees-tracking",
  shree_maruti: "shree-maruti-tracking",
};

type Bucket =
  | "created" | "confirmed" | "picked_up" | "in_transit"
  | "out_for_delivery" | "delivered" | "cancelled" | "rto" | "other";

function bucketOfStatus(status: string | null | undefined): Bucket {
  if (!status) return "created";
  const s = String(status).toLowerCase().replace(/[\s-]+/g, "_");
  if (s.includes("deliver") && !s.includes("out_for")) return "delivered";
  if (s.includes("out_for_delivery") || s.includes("ofd")) return "out_for_delivery";
  if (s.includes("rto") || s.includes("return")) return "rto";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("in_transit") || s === "intransit" || s.includes("transit") || s.includes("reached_hub")) return "in_transit";
  if (s.includes("picked") || s.includes("pickup_done")) return "picked_up";
  if (s.includes("manifest") || s.includes("confirmed") || s.includes("ready_for_dispatch") ||
      s === "booked" || s === "assigned" || s === "order_confirmed") return "confirmed";
  if (s === "created" || s === "pending" || s === "new" || s === "order_received" || s === "") return "created";
  return "other";
}

const TERMINAL: Bucket[] = ["delivered", "cancelled", "rto"];

async function pLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: caller must be an active admin, OR the scheduled cron presenting
    // the service-role key / CRON_SECRET (no user context).
    const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const cronHeader = (req.headers.get("x-cron-secret") || "").trim();
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace("Bearer ", "").trim();
    const isMachine =
      (CRON_SECRET && cronHeader === CRON_SECRET) || (bearer && bearer === SERVICE_ROLE);

    if (!isMachine) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(bearer);
      if (claimsErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: adminRow } = await admin.from("admin_users")
        .select("id").eq("user_id", claims.claims.sub).eq("is_active", true).maybeSingle();
      if (!adminRow) {
        return new Response(JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }



    const env = req.headers.get("x-environment") || "sandbox";
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit) || 500, 1000);
    const bookingIds: string[] | undefined = Array.isArray(body?.booking_ids) ? body.booking_ids : undefined;

    let query = admin.from("bookings")
      .select("id,status,booking_source,partner_id,courier_name,prayog_awb,tracking_id,prayog_order_id")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (bookingIds && bookingIds.length) query = query.in("id", bookingIds);

    const { data: bookings, error: bErr } = await query;
    if (bErr) throw bErr;

    const candidates = (bookings || []).filter((b: any) => {
      if (TERMINAL.includes(bucketOfStatus(b.status))) return false;
      if (!(b.prayog_awb || b.tracking_id)) return false;
      return true;
    });

    let updated = 0;
    let cancelled = 0;

    const skipped: { id: string; reason: string }[] = [];
    const errors: { id: string; reason: string }[] = [];

    await pLimit(candidates, 5, async (b: any) => {
      const key = resolvePartnerKey(b.booking_source, b.partner_id, b.courier_name);
      const fn = key ? PARTNER_FN[key] : undefined;
      if (!fn) { skipped.push({ id: b.id, reason: `no tracking fn for ${b.courier_name || b.booking_source || "unknown"}` }); return; }
      const awb = b.prayog_awb || b.tracking_id;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
            "x-environment": env,
          },
          body: JSON.stringify({
            waybill: awb, awb, client_request_id: awb,
            order_id: b.prayog_order_id || awb,
          }),
        });
        const json = await res.json().catch(() => ({}));
        // Courier API unavailable / errored: never infer a status, never notify.
        // The booking is left untouched and retried on the next scheduled run.
        if (!res.ok || json?.error) {
          const reason = json?.error || `HTTP ${res.status}`;
          console.warn(`[admin-refresh] booking ${b.id}: courier API failure — ${reason}; no status change, will retry`);
          errors.push({ id: b.id, reason });
          return;
        }
        const latest = (json?.statuses || [])[0];
        if (!latest) { skipped.push({ id: b.id, reason: "no statuses returned" }); return; }
        const newStatus: string = latest.subcategory || latest.status || latest.category || "";
        if (!newStatus) { skipped.push({ id: b.id, reason: "empty status" }); return; }

        // Centralised normalisation + audit trail + de-duplicated SMS trigger.
        const evt = await recordCourierStatus(admin, b, latest, { source: "cron", partnerKey: key });
        if (newStatus === b.status) return;

        // Map the canonical status back onto the legacy buckets used for
        // booking-status persistence and refunds.
        const NORM_TO_BUCKET: Record<string, Bucket> = {
          ORDER_PLACED: "created", CONFIRMED: "confirmed", IN_TRANSIT: "in_transit",
          OUT_FOR_DELIVERY: "out_for_delivery", DELIVERED: "delivered",
          CANCELLED: "cancelled", RETURNED: "rto", DELAYED: "other", FAILED: "other",
        };
        const bucket: Bucket = NORM_TO_BUCKET[evt.normalized] ?? bucketOfStatus(newStatus);

        // Partner-side cancellation (customer/courier cancelled outside the app):
        // normalise the status, keep the raw partner wording, refund + notify.
        if (bucket === "cancelled") {

          const { error: cancelErr } = await admin.from("bookings")
            .update({
              status: "CANCELLED",
              refund_reason: `Cancelled at partner: ${newStatus}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", b.id);
          if (cancelErr) { errors.push({ id: b.id, reason: cancelErr.message }); return; }

          const refund = await refundBookingIfPaid(
            admin,
            b.id,
            env === "production" ? "production" : "sandbox",
            `Cancelled at partner: ${newStatus}`,
          );
          console.log(`[admin-refresh] booking ${b.id} cancelled at partner; refund:`, JSON.stringify(refund));

          dispatchEmail("order_cancelled", b.id, { status: newStatus });
          cancelled++;
          updated++;
          return;
        }

        const { error: upErr } = await admin.from("bookings")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", b.id);
        if (upErr) { errors.push({ id: b.id, reason: upErr.message }); return; }
        if (bucket === "delivered") {
          dispatchEmail("order_completed", b.id, { status: newStatus });
        } else {
          dispatchEmail("status_change", b.id, { status: newStatus });
        }
        updated++;

      } catch (e: any) {
        errors.push({ id: b.id, reason: String(e?.message || e) });
      }
    });

    return new Response(JSON.stringify({
      checked: candidates.length,
      total: bookings?.length || 0,
      updated,
      cancelled,

      skipped,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[admin-refresh-order-statuses] error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
