import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";
import { describeFilters } from "@/lib/alerts/describe-filters";
import { alertDigestEmail } from "@/lib/email/alert-templates";
import { sendTransactional } from "@/lib/email/send";
import { getOpenJobs } from "@/lib/jobs-queries";
import { buildJobsUrl } from "@/lib/jobs-url";
import { captureException, logEvent } from "@/lib/observability";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";
import type { JobDirectoryFilters, JobListItem } from "@/lib/types/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Digest cron. Invoke with `Authorization: Bearer $CRON_SECRET`.
 * Vercel Cron: add this route in `vercel.json` once live. During development
 * you can hit it with curl once CRON_SECRET is set in .env.local.
 *
 * Semantics:
 * - Pulls every confirmed alert whose `last_sent_at` is null or older than
 *   6 days (weekly cadence, with a day of slack).
 * - Runs the same public job query the user would see with the alert's
 *   filters.
 * - Filters out jobs posted before `last_sent_at` (first run = all current
 *   jobs) and any IDs already included in the prior digest.
 * - Caps each digest at 20 jobs to keep emails readable.
 */

const WEEKLY_THROTTLE_MS = 6 * 24 * 60 * 60 * 1000;
const MAX_JOBS_PER_DIGEST = 20;

type AlertRow = {
  id: string;
  email: string;
  filters: JobDirectoryFilters | null;
  unsubscribe_token: string;
  last_sent_at: string | null;
  last_sent_job_ids: string[] | null;
};

function jsonError(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

async function processAlert(
  alert: AlertRow,
  baseUrl: string,
): Promise<{ processed: true; sent: boolean } | { processed: false }> {
  const svc = createServiceRoleSupabaseClient();
  const filters = (alert.filters ?? {}) as JobDirectoryFilters;

  const candidates = await getOpenJobs(filters);
  const lastSentAt = alert.last_sent_at ? new Date(alert.last_sent_at) : null;
  const previouslySent = new Set(alert.last_sent_job_ids ?? []);

  const fresh = candidates
    .filter((job) => {
      if (!job.published_at) return false;
      if (lastSentAt && new Date(job.published_at) <= lastSentAt) return false;
      if (previouslySent.has(job.id)) return false;
      return true;
    })
    .slice(0, MAX_JOBS_PER_DIGEST);

  if (fresh.length === 0) {
    return { processed: true, sent: false };
  }

  const description = describeFilters(filters);
  const browseUrl = `${baseUrl}${buildJobsUrl(filters)}`;
  const unsubscribeUrl = `${baseUrl}/alerts/unsubscribe?token=${alert.unsubscribe_token}`;

  const msg = alertDigestEmail({
    jobs: fresh as JobListItem[],
    description,
    siteUrl: baseUrl,
    browseUrl,
    unsubscribeUrl,
  });
  const send = await sendTransactional({
    to: alert.email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  if (!send.delivered) {
    // Keep the row as-is so next run retries. Don't advance last_sent_at.
    return { processed: true, sent: false };
  }

  const { error: updErr } = await svc
    .from("job_alerts")
    .update({
      last_sent_at: new Date().toISOString(),
      last_sent_job_ids: fresh.map((j) => j.id),
    })
    .eq("id", alert.id);

  if (updErr) {
    captureException(updErr, {
      event: "alert_digest_update_failed",
      alert_id: alert.id,
    });
  }

  return { processed: true, sent: true };
}

async function handle(req: Request) {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) {
    return jsonError(503, { error: "CRON_SECRET not configured" });
  }

  const auth = req.headers.get("authorization") ?? "";
  // Vercel Cron uses `Bearer <secret>`; support the same for manual curl.
  const expected = `Bearer ${configured}`;
  if (auth !== expected) {
    return jsonError(401, { error: "Unauthorized" });
  }

  if (!isServiceRoleAvailable()) {
    return jsonError(503, { error: "Service role not configured" });
  }

  const svc = createServiceRoleSupabaseClient();
  const cutoff = new Date(Date.now() - WEEKLY_THROTTLE_MS).toISOString();

  const { data, error } = await svc
    .from("job_alerts")
    .select(
      "id, email, filters, unsubscribe_token, last_sent_at, last_sent_job_ids",
    )
    .not("confirmed_at", "is", null)
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`);

  if (error) {
    captureException(error, { event: "alert_cron_select_failed" });
    return jsonError(500, { error: "select_failed" });
  }

  const alerts = (data ?? []) as AlertRow[];
  const baseUrl = getAppBaseUrl();

  let sent = 0;
  let skipped = 0;
  for (const alert of alerts) {
    const result = await processAlert(alert, baseUrl);
    if (!result.processed) continue;
    if (result.sent) sent += 1;
    else skipped += 1;
  }

  logEvent("alert_cron_run", {
    candidates: alerts.length,
    sent,
    skipped,
  });
  return NextResponse.json({
    ok: true,
    candidates: alerts.length,
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
