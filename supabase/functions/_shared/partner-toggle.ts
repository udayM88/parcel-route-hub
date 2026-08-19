// Shared guard: admins can disable a courier partner from the admin panel.
// The toggle lives in `system_settings` under the key `courier_partners`:
//   { "delhivery": { "enabled": true, "note": "" }, ... }
// Serviceability functions call `isPartnerEnabled()` first so a stale client
// can never quote a partner that has been turned off.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ToggleMap = Record<string, { enabled?: boolean; note?: string } | undefined>;

let cache: { at: number; map: ToggleMap } | null = null;
const TTL_MS = 30_000;

async function loadToggles(): Promise<ToggleMap> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "courier_partners")
      .maybeSingle();
    const map = (data?.value ?? {}) as ToggleMap;
    cache = { at: Date.now(), map };
    return map;
  } catch (e) {
    console.warn("[partner-toggle] failed to read settings, defaulting to enabled", String(e));
    return {};
  }
}

/** Returns false only when the partner has been explicitly disabled by an admin. */
export async function isPartnerEnabled(partnerCode: string): Promise<boolean> {
  const map = await loadToggles();
  const entry = map[partnerCode];
  if (!entry) return true;
  return entry.enabled !== false;
}

/** Standard "partner disabled" serviceability response. */
export function partnerDisabledResponse(
  partnerCode: string,
  corsHeaders: Record<string, string>,
) {
  return new Response(
    JSON.stringify({
      is_serviceable: false,
      partner: null,
      reason: "partner_disabled",
      message: `${partnerCode} is currently disabled by ViaSetu operations.`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
