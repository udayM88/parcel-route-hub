import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAllowedWebhookUrl } from "./webhook-security.ts";

interface MerchantWebhookSubscription {
  id: string;
  endpoint_url: string;
  signing_secret: string;
  event_types?: string[] | null;
}

interface MerchantWebhookBooking {
  id: string;
  business_account_id?: string | null;
  prayog_awb?: string | null;
  tracking_id?: string | null;
  courier_name?: string | null;
}

interface EdgeRuntimeGlobal {
  waitUntil?: (promise: Promise<unknown>) => void;
}

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

async function deliverMerchantWebhook(
  admin: SupabaseClient,
  subscription: MerchantWebhookSubscription,
  booking: MerchantWebhookBooking,
  eventId: string,
  previousStatus: string | null,
  normalizedStatus: string,
) {
  const type = "shipment.status_changed";
  if (!subscription.event_types?.includes(type)) return;
  if (!isAllowedWebhookUrl(String(subscription.endpoint_url))) return;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const deliveryId = crypto.randomUUID();
  const payload = JSON.stringify({
    id: deliveryId,
    type,
    created_at: new Date().toISOString(),
    livemode: true,
    data: {
      object: {
        booking_id: booking.id,
        awb: booking.prayog_awb || booking.tracking_id || null,
        courier: booking.courier_name || null,
        previous_status: previousStatus,
        status: normalizedStatus,
        status_event_id: eventId,
      },
    },
  });
  const signature = await hmacHex(String(subscription.signing_secret), `${timestamp}.${payload}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let status = 0;
  try {
    const response = await fetch(String(subscription.endpoint_url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ViaSetu-Webhooks/1.0",
        "X-ViaSetu-Event": type,
        "X-ViaSetu-Delivery": deliveryId,
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
    last_delivery_at: new Date().toISOString(),
    last_delivery_status: status,
  }).eq("id", subscription.id);
}

export async function notifyMerchantWebhooks(
  admin: SupabaseClient,
  booking: MerchantWebhookBooking,
  eventId: string,
  previousStatus: string | null,
  normalizedStatus: string,
) {
  if (!booking.business_account_id) return;
  const { data: subscriptions } = await admin.from("merchant_webhook_subscriptions").select("*")
    .eq("business_account_id", booking.business_account_id).eq("is_active", true);
  if (!subscriptions?.length) return;
  await Promise.allSettled((subscriptions as MerchantWebhookSubscription[]).map((subscription) =>
    deliverMerchantWebhook(admin, subscription, booking, eventId, previousStatus, normalizedStatus)));
}

export function dispatchMerchantWebhooks(
  admin: SupabaseClient,
  booking: MerchantWebhookBooking,
  eventId: string,
  previousStatus: string | null,
  normalizedStatus: string,
) {
  const promise = notifyMerchantWebhooks(admin, booking, eventId, previousStatus, normalizedStatus);
  const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: EdgeRuntimeGlobal }).EdgeRuntime;
  runtime?.waitUntil?.(promise);
}
