/**
 * Best-effort validator for user-supplied public URLs. Rejects anything that
 * isn't an http:// or https:// URL with a hostname that contains a dot. This
 * keeps obvious junk out (whitespace, schemes like javascript: / data: /
 * mailto: / file:, bare hostnames without a TLD) without requiring DNS or
 * HEAD checks.
 *
 * Use this anywhere a candidate or employer enters a URL that we will later
 * render back as an `<a href>` — relying on `URL.canParse` is NOT sufficient
 * because it accepts `javascript:` and other dangerous schemes.
 */
export function isValidPublicUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!u.hostname || !u.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Defensive wrapper for rendering user-supplied URLs in `<a href>`. Returns
 * the trimmed URL when it passes `isValidPublicUrl`, otherwise null.
 *
 * Components should branch on the return value: a null result means we
 * refuse to render an outbound link rather than risk emitting an unsafe one.
 */
export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return isValidPublicUrl(trimmed) ? trimmed : null;
}
