import "server-only";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * Canonical email footer text (and HTML) used across every transactional
 * template. Keeping this in one place stops the small drift we had —
 * "TheCOE" alone in some, full tagline in others, missing separator,
 * etc.
 */
export const FOOTER_TEXT = `—\n${SITE_NAME}\n${SITE_TAGLINE}`;

export const FOOTER_HTML = `<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;" /><p style="margin:0;font-size:12px;color:#888;">${SITE_NAME} · ${SITE_TAGLINE}</p>`;
