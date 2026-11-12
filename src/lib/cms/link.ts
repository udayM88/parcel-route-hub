export function normalizeCmsLinkHref(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//'))) return value;
  if (/^(mailto|tel):/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) return null;

  const candidate = value.startsWith('//')
    ? `https:${value}`
    : /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}
