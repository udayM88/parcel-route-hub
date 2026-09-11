// Centralized auth session helper.
// Reads the new `auth_session` key, with backward-compat fallback to legacy
// `prayog_auth` so existing logged-in users aren't kicked out after the
// Prayog removal migration.

export interface AuthSession {
  phone?: string;         // Stored as +91XXXXXXXXXX for OTP users
  email?: string;         // Primary email for Clerk users
  auth_provider?: 'phone' | 'clerk';
  external_auth_id?: string;
  user_id: string;        // Stable UUID used by ViaSetu data tables
  customer_id: string;    // Same as user_id (kept for compat)
  userName?: string;
  full_name?: string;
  authenticated_at?: string;
}

const NEW_KEY = 'auth_session';
const LEGACY_KEY = 'prayog_auth';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getAuthSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(NEW_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.user_id) return null;
    // Invalidate stale sessions whose user_id is the old Base64 string
    // (incompatible with Postgres uuid columns). Force re-login.
    if (!UUID_REGEX.test(parsed.user_id)) {
      localStorage.removeItem(NEW_KEY);
      localStorage.removeItem(LEGACY_KEY);
      return null;
    }
    return parsed as AuthSession;
  } catch {
    return null;
  }
};

export const setAuthSession = (session: AuthSession) => {
  localStorage.setItem(NEW_KEY, JSON.stringify(session));
  // Mirror to legacy key so any not-yet-migrated reader still works during
  // the transition window. Safe to remove later.
  localStorage.setItem(LEGACY_KEY, JSON.stringify(session));
};

export const clearAuthSession = () => {
  localStorage.removeItem(NEW_KEY);
  localStorage.removeItem(LEGACY_KEY);
  window.dispatchEvent(new CustomEvent('viasetu:logout'));
};

export const isAuthenticated = (): boolean => Boolean(getAuthSession());

// Generate a deterministic UUID v5-style user_id from the phone number.
// This is required because the `bookings.user_id` and `profiles.user_id`
// columns are typed as `uuid` in Postgres. Using a stable UUID derived from
// the phone keeps the "same phone = same account" guarantee while staying
// schema-compatible.
//
// Namespace: a fixed UUID for the ViaSetu phone-login system.
const VIASETU_PHONE_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

const hexToBytes = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
};

const bytesToUuid = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const deriveUserId = async (phoneDigits: string): Promise<string> => {
  const phoneWithCountryCode = `+91${phoneDigits}`;
  const namespaceBytes = hexToBytes(VIASETU_PHONE_NAMESPACE.replace(/-/g, ''));
  const nameBytes = new TextEncoder().encode(phoneWithCountryCode);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const hashBytes = new Uint8Array(hashBuffer).slice(0, 16);
  // Set UUID v5 version + variant bits
  hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
  hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
  return bytesToUuid(hashBytes);
};

// Clerk account IDs are not UUIDs, while ViaSetu's customer tables use UUIDs.
// Derive a stable UUID without requiring or inventing a mobile number.
export const deriveClerkUserId = async (clerkUserId: string): Promise<string> => {
  const namespaceBytes = hexToBytes(VIASETU_PHONE_NAMESPACE.replace(/-/g, ''));
  const nameBytes = new TextEncoder().encode(`clerk:${clerkUserId}`);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const hashBytes = new Uint8Array(hashBuffer).slice(0, 16);
  hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
  hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
  return bytesToUuid(hashBytes);
};
