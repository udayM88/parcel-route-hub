import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAllowedWebhookUrl } from "../_shared/webhook-security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const hmacHex = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(projectUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData } = await authClient.auth.getUser();
    if (!authData.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const subscriptionId = String(body.subscription_id || "");
    if (!subscriptionId) return json({ error: "subscription_id required" }, 400);

    const admin = createClient(projectUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: business } = await admin.from("business_accounts").select("id")
      .eq("user_id", authData.user.id).eq("status", "approved").eq("is_active", true).maybeSingle();
    if (!business) return json({ error: "Approved merchant account required" }, 403);

    const { data: subscription } = await admin.from("merchant_webhook_subscriptions").select("*")
      .eq("id", subscriptionId).eq("business_account_id", business.id).maybeSingle();
    if (!subscription) return json({ error: "Webhook endpoint not found" }, 404);
    if (!subscription.is_active) return json({ error: "Enable the endpoint before testing it" }, 409);
    if (!isAllowedWebhookUrl(subscription.endpoint_url)) return json({ error: "Webhook URL must be a public HTTPS endpoint" }, 400);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const eventId = crypto.randomUUID();
    const payload = JSON.stringify({
      id: eventId,
      type: "shipment.status_changed",
      created_at: new Date().toISOString(),
      livemode: false,
      data: {
        object: {
          booking_id: "test_booking",
          awb: "VS_TEST_AWB",
          previous_status: "ready_for_dispatch",
          status: "in_transit",
        },
      },
    });
    const signature = await hmacHex(subscription.signing_secret, `${timestamp}.${payload}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let status = 0;
    try {
      const response = await fetch(subscription.endpoint_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ViaSetu-Webhooks/1.0",
          "X-ViaSetu-Event": "shipment.status_changed",
          "X-ViaSetu-Delivery": eventId,
          "X-ViaSetu-Timestamp": timestamp,
          "X-ViaSetu-Signature": `sha256=${signature}`,
        },
        body: payload,
        signal: controller.signal,
      });
      status = response.status;
    } catch (error) {
      status = error instanceof DOMException && error.name === "AbortError" ? 408 : 0;
    } finally {
      clearTimeout(timeout);
    }

    await admin.from("merchant_webhook_subscriptions").update({
      last_tested_at: new Date().toISOString(),
      last_test_status: status,
    }).eq("id", subscription.id);

    if (status < 200 || status >= 300) {
      return json({ success: false, status, error: status === 408 ? "Endpoint timed out" : `Endpoint returned HTTP ${status || "connection error"}` }, 422);
    }
    return json({ success: true, status, delivery_id: eventId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
