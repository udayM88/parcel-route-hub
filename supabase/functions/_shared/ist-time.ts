// Indian courier APIs (Delhivery, Shree Maruti, UrbaneBolt) return scan
// timestamps in IST but WITHOUT a timezone offset, e.g. "2026-08-27T14:29:29.002".
// `new Date(...)` in the edge runtime parses those as UTC, which shifts every
// event +5:30 in the UI (a 2:30 PM delivery shows as 7:59 PM).
// Treat naive datetime strings as IST; respect explicit offsets when present.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const HAS_TZ = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Returns epoch ms, or NaN when unparseable. */
export function parseIstMs(value: unknown): number {
  if (value == null) return NaN;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();

  const raw = String(value).trim();
  if (!raw) return NaN;

  // "2026-08-27 14:29:29" -> "2026-08-27T14:29:29"
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");

  if (HAS_TZ.test(normalized)) return Date.parse(normalized);

  const ms = Date.parse(`${normalized}Z`);
  if (isNaN(ms)) return Date.parse(raw);
  return ms - IST_OFFSET_MS;
}

/** Normalises any partner timestamp to a true UTC ISO string. */
export function toUtcIso(value: unknown, fallback = Date.now()): string {
  const ms = parseIstMs(value);
  return new Date(isNaN(ms) ? fallback : ms).toISOString();
}
