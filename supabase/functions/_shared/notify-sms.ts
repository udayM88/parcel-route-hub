// Fire-and-forget SMS notification dispatcher (order events only).
// Mirrors notify-email.ts. Never throws — SMS failures must not affect the
// calling business flow. Does not touch the OTP functions.
export async function notifySms(
  event: string,
  bookingId: string | null,
  opts: { statusEventId?: string | null; vars?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-sms`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        event,
        booking_id: bookingId,
        status_event_id: opts.statusEventId ?? null,
        vars: opts.vars ?? {},
      }),
    });
  } catch (e) {
    console.error("[notifySms] failed", event, bookingId, String(e));
  }
}

export function dispatchSms(
  event: string,
  bookingId: string | null,
  opts: { statusEventId?: string | null; vars?: Record<string, unknown> } = {},
): void {
  try {
    const p = notifySms(event, bookingId, opts);
    // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p);
    }
  } catch (e) {
    console.error("[dispatchSms] failed", event, String(e));
  }
}
