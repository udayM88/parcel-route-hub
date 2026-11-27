// Super admin / operations: retry a paid booking whose courier booking failed
// (e.g. low partner wallet balance) after the partner account is recharged.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { retryBlockReason } from "./eligibility.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-environment",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
      .select("role, email").eq("user_id", claims.claims.sub).eq("is_active", true).maybeSingle();
    if (!adminRow || !["super_admin", "operations"].includes(adminRow.role)) {
      return json({ error: "Only super admins and operations staff can retry bookings" }, 403);
    }

    const parsed = z.object({ booking_id: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return json({ error: "booking_id required" }, 400);
    const { booking_id } = parsed.data;

    const { data: b } = await admin.from("bookings").select("*").eq("id", booking_id).maybeSingle();
    if (!b) return json({ error: "Booking not found" }, 404);
    const block = retryBlockReason(b);
    if (block) return json({ error: block }, 409);

    const { data: moved } = await admin.from("bookings")
      .update({ status: "BOOKING_RETRY" }).eq("id", booking_id)
      .in("status", ["PAYMENT_RECEIVED", "FAILED", "BOOKING_RETRY"]).select("id").maybeSingle();
    if (!moved) return json({ error: "Booking changed meanwhile; refresh and try again." }, 409);
    console.log("[admin-retry-booking]", booking_id, "by", adminRow.email);

    const env = req.headers.get("x-environment") || "production";
    const res = await fetch(`${URL_}/functions/v1/create-consumer-shipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}`, "x-internal-key": SERVICE, "x-environment": env },
      body: JSON.stringify({ booking_id }),
    });
    const result = await res.json().catch(() => ({}));
    const { data: after } = await admin.from("bookings")
      .select("status, prayog_awb, failure_reason").eq("id", booking_id).maybeSingle();
    return json({ booked: !!after?.prayog_awb, awb: after?.prayog_awb ?? null, status: after?.status, failure_reason: after?.failure_reason, result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Retry failed" }, 500);
  }
});
