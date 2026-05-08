import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TTL for resume signed URLs across the app.
 *
 * Why one TTL everywhere:
 *   - Pages that link to a resume render once and the user clicks within
 *     seconds — anything past 5 minutes is wasted lifetime that just widens
 *     the leak window if the URL is ever copy-pasted.
 *   - Different TTLs (600 / 900) on different surfaces are confusing for
 *     QA ("why does this download work for me but not them?") and they
 *     don't actually protect anything different. Resumes are sensitive
 *     PII; we want a tight default and one place to bump it.
 *
 * 15 minutes (900s) is the floor that still survives slow connections,
 * tab-restore reloads, and "open in new tab" navigation.
 */
export const RESUME_SIGNED_URL_TTL_SECONDS = 900;

/**
 * Human-readable expiry label for surfaces that link to a signed resume URL.
 * Sourced from the same constant the URL is signed with so they cannot drift.
 */
export const RESUME_SIGNED_URL_EXPIRY_LABEL = formatExpiryLabel(
  RESUME_SIGNED_URL_TTL_SECONDS,
);

function formatExpiryLabel(ttlSeconds: number): string {
  if (ttlSeconds % 60 === 0) {
    const minutes = ttlSeconds / 60;
    return `Link expires in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  return `Link expires in ${ttlSeconds} seconds.`;
}

const RESUME_BUCKET = "candidate-resumes";

export async function getResumeSignedUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, RESUME_SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
