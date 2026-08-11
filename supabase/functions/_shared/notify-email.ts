// Fire-and-forget email notification dispatcher.
// Never throws — email failures must not affect the calling business flow.
export async function notifyEmail(
  event: string,
  bookingId: string | null,
  vars: Record<string, unknown> = {},
): Promise<void> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification-email`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({ event, booking_id: bookingId, vars }),
    });
  } catch (e) {
    console.error("[notifyEmail] failed", event, bookingId, String(e));
  }
}

// Schedules the notification without blocking the caller.
export function dispatchEmail(
  event: string,
  bookingId: string | null,
  vars: Record<string, unknown> = {},
): void {
  try {
    const p = notifyEmail(event, bookingId, vars);
    // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(p);
    }
  } catch (e) {
    console.error("[dispatchEmail] failed", event, String(e));
  }
}
