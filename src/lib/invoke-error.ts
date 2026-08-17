// Extract a rich, admin-friendly error string from a supabase.functions.invoke()
// call so we can persist it into bookings.partner_error_raw instead of the
// generic "Edge Function returned a non-2xx status code" message.
//
// Usage:
//   const { data, error } = await supabase.functions.invoke(fn, { body });
//   if (error || !data?.success) {
//     const detail = await extractInvokeError(data, error);
//     // → detail includes HTTP status + partner response body when available
//   }

export async function extractInvokeError(
  result: any,
  error: any,
): Promise<string> {
  const parts: string[] = [];

  // 1. Try to read the underlying Response from FunctionsHttpError.context.
  //    supabase-js attaches the raw Response there for non-2xx replies.
  const ctx: Response | undefined = error?.context;
  if (ctx && typeof ctx.text === "function") {
    try {
      const cloned = typeof ctx.clone === "function" ? ctx.clone() : ctx;
      const bodyText = await cloned.text();
      if (bodyText) {
        parts.push(`status=${ctx.status ?? "?"}`);
        // Try to surface JSON error fields cleanly.
        try {
          const j = JSON.parse(bodyText);
          const msg = j?.error || j?.message || j?.details;
          if (msg) parts.push(`body=${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
          else parts.push(`body=${bodyText.slice(0, 1500)}`);
        } catch {
          parts.push(`body=${bodyText.slice(0, 1500)}`);
        }
      } else if (ctx.status) {
        parts.push(`status=${ctx.status}`);
      }
    } catch {
      // ignore — fall through to other sources
    }
  }

  // 2. If the function returned 2xx but with { success: false, error: ... }.
  if (parts.length === 0 && result) {
    const msg = result?.error || result?.message || result?.details;
    if (msg) parts.push(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  // 3. Fallback to the JS error message.
  if (parts.length === 0 && error?.message) {
    parts.push(String(error.message));
  }

  if (parts.length === 0) parts.push("unknown error");

  return parts.join(" | ").slice(0, 1800);
}
