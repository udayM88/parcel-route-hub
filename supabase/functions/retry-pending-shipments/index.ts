// Sweeper: recovers bookings whose payment was captured but whose partner
// shipment never got created (browser closed, network drop, partner timeout).
//
// - resets rows stuck at BOOKING_IN_PROGRESS for > 10 minutes
// - retries create-consumer-shipment for paid rows with no AWB older than 3 min
//
// Safe to call repeatedly (cron every 5 minutes) — create-consumer-shipment
// claims each row atomically, so there is no double booking.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const env = req.headers.get("x-environment") || "production";

  try {
    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const threeMinAgo = new Date(now - 3 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();

    // 1. Unstick abandoned in-progress claims.
    await admin.from("bookings")
      .update({ status: "PAYMENT_RECEIVED" })
      .eq("status", "BOOKING_IN_PROGRESS")
      .is("prayog_awb", null)
      .lt("updated_at", tenMinAgo);

    // 2. Find paid, AWB-less rows to retry.
    const { data: rows, error } = await admin
      .from("bookings")
      .select("id,created_at,courier_name,partner_id")
      .eq("payment_status", "paid")
      .in("status", ["PAYMENT_RECEIVED", "PENDING", "BOOKING_RETRY"])
      .is("prayog_awb", null)
      .lt("created_at", threeMinAgo)
      .gt("created_at", twoDaysAgo)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    const results: unknown[] = [];
    for (const row of rows || []) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/create-consumer-shipment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-key": serviceKey,
            "x-environment": env,
          },
          body: JSON.stringify({ booking_id: row.id }),
        });
        const out = await res.json().catch(() => ({}));
        results.push({ booking_id: row.id, status: res.status, ...out, booking: undefined });
      } catch (e) {
        results.push({ booking_id: row.id, error: String(e) });
      }
    }

    console.log(`[retry-pending-shipments] processed ${results.length} rows`);
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[retry-pending-shipments] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
