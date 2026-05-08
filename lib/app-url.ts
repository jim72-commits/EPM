/**
 * Canonical app base URL for metadata, sitemaps, email links, OAuth
 * callbacks, etc. Prefer NEXT_PUBLIC_APP_URL (production domain), fall back
 * to a localhost default so dev builds never crash.
 */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}
