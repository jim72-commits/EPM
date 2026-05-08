/**
 * Compose a public URL for an org logo stored in the `org-logos` bucket.
 *
 * The bucket is public, so this is just a static URL build — no signed URLs,
 * no per-request DB hit. We return null when:
 *   - the path is missing (org never uploaded)
 *   - Supabase isn't configured (dev / preview without a real backend); the
 *     UI falls back to an initials chip in that case.
 */
export function getOrgLogoUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmedBase}/storage/v1/object/public/org-logos/${encodeURI(storagePath)}`;
}
