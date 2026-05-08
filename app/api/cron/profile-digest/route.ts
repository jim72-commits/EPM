import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { findProfileMatches } from "@/lib/digest/profile-match";
import { profileDigestEmail } from "@/lib/email/digest-templates";
import { sendTransactional } from "@/lib/email/send";
import { captureException, logEvent } from "@/lib/observability";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly profile-match digest cron.
 *
 * Run schedule: Monday 14:00 UTC (Vercel Cron entry to be added in
 * `vercel.json`). Auth header: `Bearer $CRON_SECRET` — same convention as
 * the alerts cron.
 *
 * Selection
 *  - candidate_profiles where digest_opt_in is true AND
 *    digest_last_sent_at is null OR < 6 days ago.
 *
 * For each candidate
 *  - Pull matching jobs since the last send (or since 7 days ago for first
 *    runs).
 *  - Skip candidates with 0 matches without advancing last_sent_at — that
 *    way, quiet weeks don't reset their cadence.
 *  - On a delivered send, store last_sent_at = now and last_job_ids.
 */

const WEEKLY_THROTTLE_MS = 6 * 24 * 60 * 60 * 1000;
const MAX_JOBS_PER_DIGEST = 12;

function jsonError(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

type ProfileForDigest = {
  user_id: string;
  full_name: string;
  country_code: "US" | "CA";
  work_auth_us: "citizen" | "permanent_resident" | "visa_required" | "none";
  work_auth_ca: "citizen" | "permanent_resident" | "visa_required" | "none";
  open_to_remote: boolean;
  open_to_hybrid: boolean;
  open_to_onsite: boolean;
  digest_last_sent_at: string | null;
  digest_last_job_ids: string[] | null;
};

async function processProfile(
  profile: ProfileForDigest,
  baseUrl: string,
): Promise<{ sent: boolean; reason: string }> {
  const svc = createServiceRoleSupabaseClient();

  const matches = await findProfileMatches(profile, {
    since: profile.digest_last_sent_at,
    excludeJobIds: new Set(profile.digest_last_job_ids ?? []),
    limit: MAX_JOBS_PER_DIGEST,
  });

  if (matches.length === 0) {
    return { sent: false, reason: "no_matches" };
  }

  // Pull the candidate's email from auth.users via the admin API. We don't
  // duplicate the email into candidate_profiles, so this is a per-send hit
  // — fine at this volume.
  const { data: authUser, error: authErr } =
    await svc.auth.admin.getUserById(profile.user_id);

  if (authErr || !authUser?.user?.email) {
    captureException(authErr ?? new Error("missing_email"), {
      scope: "profile_digest.fetch_email",
      user_id: profile.user_id,
    });
    return { sent: false, reason: "no_email" };
  }

  const email = authUser.user.email;
  const greeting = profile.full_name?.trim().split(/\s+/)[0] ?? "there";
  const optOutUrl = `${baseUrl}/me/profile`;

  const msg = profileDigestEmail({
    greeting,
    jobs: matches,
    baseUrl,
    optOutUrl,
  });

  const send = await sendTransactional({
    to: email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  if (!send.delivered) {
    return { sent: false, reason: "send_failed" };
  }

  const { error: updErr } = await svc
    .from("candidate_profiles")
    .update({
      digest_last_sent_at: new Date().toISOString(),
      digest_last_job_ids: matches.map((j) => j.id),
    })
    .eq("user_id", profile.user_id);

  if (updErr) {
    captureException(updErr, {
      scope: "profile_digest.update",
      user_id: profile.user_id,
    });
    // We've already delivered — log and move on. Worst case the candidate
    // gets the same set of jobs in next week's run; the dedupe set fixes
    // that on the run after.
  }

  return { sent: true, reason: "delivered" };
}

async function handle(req: Request) {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) {
    return jsonError(503, { error: "CRON_SECRET not configured" });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${configured}`) {
    return jsonError(401, { error: "Unauthorized" });
  }

  if (!isServiceRoleAvailable()) {
    return jsonError(503, { error: "Service role not configured" });
  }

  const svc = createServiceRoleSupabaseClient();
  const cutoff = new Date(Date.now() - WEEKLY_THROTTLE_MS).toISOString();

  const { data, error } = await svc
    .from("candidate_profiles")
    .select(
      "user_id,full_name,country_code,work_auth_us,work_auth_ca,open_to_remote,open_to_hybrid,open_to_onsite,digest_last_sent_at,digest_last_job_ids",
    )
    .eq("digest_opt_in", true)
    .or(`digest_last_sent_at.is.null,digest_last_sent_at.lt.${cutoff}`);

  if (error) {
    captureException(error, { event: "profile_digest_cron_select_failed" });
    return jsonError(500, { error: "select_failed" });
  }

  const profiles = (data ?? []) as ProfileForDigest[];
  const baseUrl = getAppBaseUrl();

  let sent = 0;
  const skipped: Record<string, number> = {};

  for (const profile of profiles) {
    const result = await processProfile(profile, baseUrl);
    if (result.sent) {
      sent += 1;
    } else {
      skipped[result.reason] = (skipped[result.reason] ?? 0) + 1;
    }
  }

  logEvent("profile_digest_cron_run", {
    candidates: profiles.length,
    sent,
    skipped,
  });

  return NextResponse.json({
    ok: true,
    candidates: profiles.length,
    sent,
    skipped,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
