/**
 * Courier label links (Delhivery / XpressBees S3) are pre-signed and expire
 * (typically after 24h). A cached `label_url` on a booking row must therefore be
 * validated before we open it — otherwise the user gets an "Access Denied" XML
 * page instead of the shipping label.
 */
export function isFreshLabelUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith("data:")) return true;

  const signedAtMatch = url.match(/X-Amz-Date=(\d{8}T\d{6}Z)/);
  const expiresMatch = url.match(/X-Amz-Expires=(\d+)/);
  if (!signedAtMatch || !expiresMatch) return true; // not pre-signed → durable

  const d = signedAtMatch[1];
  const signedAt = Date.parse(
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`,
  );
  if (Number.isNaN(signedAt)) return false;

  // Treat as stale 15 minutes before actual expiry.
  return Date.now() < signedAt + (Number(expiresMatch[1]) - 900) * 1000;
}
