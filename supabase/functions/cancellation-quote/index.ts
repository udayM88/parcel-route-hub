import { createClient } from "npm:@supabase/supabase-js@2";
import { isStaffRequest, quoteCancellation } from "../_shared/refund.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment, x-prayog-auth",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "");
    if (!UUID.test(bookingId)) return json({ error: "valid booking_id required" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const staff = await isStaffRequest(req, admin);
    const quote = await quoteCancellation(admin, bookingId, staff && body?.waive_cancellation_fee === true);
    if (!quote) return json({ error: "Booking not found" }, 404);
    return json({ quote, is_staff: staff });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
