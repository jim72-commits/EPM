"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getOptionalAuth } from "@/lib/auth/admin";
import { captureException, logEvent } from "@/lib/observability";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const REPORT_REASONS = [
  "spam",
  "scam",
  "misleading",
  "off_topic",
  "harassment",
  "other",
] as const;

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters).")
    .max(4000, "Keep it under 4000 characters."),
  reporter_email: z
    .string()
    .trim()
    .email("That doesn't look like a valid email.")
    .max(320)
    .nullable(),
});

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function errorRedirect(slug: string, message: string): never {
  redirect(`/jobs/${slug}/report?error=${encodeURIComponent(message)}`);
}

/**
 * File a trust-and-safety report against a listing. Anonymous and signed-in
 * users both go through this single path. We never auto-action anything;
 * admins triage from /admin/reports.
 */
export async function reportListing(slug: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(`/jobs/${slug}?reported=stub`);
  }

  const parsed = reportSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details"),
    reporter_email: emptyToNull(formData.get("reporter_email")),
  });

  if (!parsed.success) {
    errorRedirect(slug, parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await getOptionalAuth();

  // Resolve the slug -> job_id via a single round-trip. We don't expose
  // job_id directly in the URL since the public-facing slug is what users
  // recognize.
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();

  if (jobErr || !job) {
    errorRedirect(slug, "Listing not found.");
  }

  // Soft de-dupe: if the same logged-in user already filed an open report
  // on this listing, we don't accept another one. Anonymous users skip
  // this guard (no stable identity to dedupe against without IP tracking,
  // which we're deliberately not adding for now).
  if (auth.user) {
    const { data: existing } = await supabase
      .from("listing_reports")
      .select("id")
      .eq("job_id", job.id)
      .eq("reporter_user_id", auth.user.id)
      .eq("status", "open")
      .maybeSingle();

    if (existing) {
      redirect(`/jobs/${slug}/report?duplicate=1`);
    }
  }

  const insertPayload = {
    job_id: job.id,
    reporter_user_id: auth.user?.id ?? null,
    reporter_email: parsed.data.reporter_email,
    reason: parsed.data.reason,
    details: parsed.data.details,
  };

  const { error: insertErr } = await supabase
    .from("listing_reports")
    .insert(insertPayload);

  if (insertErr) {
    // The RLS policy now enforces a soft rate limit. When the cap is hit,
    // Postgres returns 42501 (permission denied). Tell the reporter why
    // we're holding off rather than dumping a generic failure.
    const rateLimited = insertErr.code === "42501";
    if (rateLimited) {
      logEvent("listing_reported_rate_limited", {
        slug,
        job_id: job.id,
        reporter_user_id: auth.user?.id ?? null,
        has_reporter_email: parsed.data.reporter_email !== null,
      });
      errorRedirect(
        slug,
        "You've hit the report rate limit. Wait an hour and try again, or email support if it's urgent.",
      );
    }

    captureException(insertErr, {
      scope: "report_listing.insert",
      slug,
    });
    errorRedirect(slug, "Couldn't file the report. Try again in a minute.");
  }

  logEvent("listing_reported", {
    slug,
    job_id: job.id,
    reason: parsed.data.reason,
    reporter_user_id: auth.user?.id ?? null,
    has_reporter_email: parsed.data.reporter_email !== null,
  });

  revalidatePath("/admin/reports");
  redirect(`/jobs/${slug}?reported=1`);
}
