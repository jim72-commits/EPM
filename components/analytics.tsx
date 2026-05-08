import Script from "next/script";

/**
 * Env-gated privacy-friendly analytics. Uses Plausible by default.
 *
 * To enable:
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=thecoe.com
 *   NEXT_PUBLIC_PLAUSIBLE_SRC=https://plausible.io/js/script.js   (optional; default)
 *
 * Plausible is GDPR/CCPA-friendly and does not set cookies or collect PII,
 * so no consent banner is required in most jurisdictions for pageview
 * analytics.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return null;

  const src =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SRC?.trim() ||
    "https://plausible.io/js/script.js";

  return (
    <Script
      defer
      data-domain={domain}
      src={src}
      strategy="afterInteractive"
    />
  );
}
