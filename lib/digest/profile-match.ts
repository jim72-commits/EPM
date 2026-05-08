import "server-only";

import { getOpenJobs } from "@/lib/jobs-queries";
import type { JobListItem } from "@/lib/types/jobs";

/**
 * Subset of `CandidateProfile` actually consumed by the matcher. Keeping the
 * shape narrow lets cron paths pass a partial select without a full profile
 * fetch.
 */
export type DigestProfileSubset = {
  work_auth_us: "citizen" | "permanent_resident" | "visa_required" | "none";
  work_auth_ca: "citizen" | "permanent_resident" | "visa_required" | "none";
  open_to_remote: boolean;
  open_to_hybrid: boolean;
  open_to_onsite: boolean;
};

/**
 * Decide which open jobs are a sensible weekly-digest match for a candidate.
 *
 * Heuristics — kept deliberately narrow so the email feels useful, not spam:
 *
 *   1. Country must overlap. We push a `country` filter to the SQL query so
 *      we don't fetch jobs the candidate can't legally take. The candidate's
 *      profile lists work-auth on a per-country basis; we include a country
 *      only if their auth there is not "none".
 *
 *   2. Remote-policy must match the candidate's open_to_* flags. Done in
 *      memory after fetch, since `getOpenJobs` accepts a single remote
 *      filter and we may need a union.
 *
 *   3. Only jobs published since the last digest are eligible — that's the
 *      "weekly" framing. The cron passes us `since`; first run will pass
 *      `null` and we fall back to "last 7 days".
 *
 *   4. Jobs already sent in the previous digest are filtered out, even if
 *      they qualify on time bounds. Pure deduplication safety.
 */

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type DigestMatchOptions = {
  /** Candidate's last digest send time, or null on first run. */
  since: string | null;
  /** Job ids included in the previous digest (skip-set). */
  excludeJobIds: ReadonlySet<string>;
  /** Hard cap on results to keep emails readable. */
  limit: number;
};

export async function findProfileMatches(
  profile: DigestProfileSubset,
  opts: DigestMatchOptions,
): Promise<JobListItem[]> {
  const eligibleCountries: Array<"US" | "CA"> = [];
  if (profile.work_auth_us !== "none") eligibleCountries.push("US");
  if (profile.work_auth_ca !== "none") eligibleCountries.push("CA");

  // Candidate isn't authorized to work anywhere we list — nothing to send.
  if (eligibleCountries.length === 0) return [];

  const acceptedRemote = new Set<JobListItem["remote_policy"]>([
    "flexible",
  ]);
  if (profile.open_to_remote) acceptedRemote.add("remote");
  if (profile.open_to_hybrid) acceptedRemote.add("hybrid");
  if (profile.open_to_onsite) acceptedRemote.add("onsite");

  // Candidate said "no" to every working arrangement — bail rather than
  // spam them with roles they wouldn't accept anyway.
  if (acceptedRemote.size === 1 /* only "flexible" */) {
    if (
      !profile.open_to_remote &&
      !profile.open_to_hybrid &&
      !profile.open_to_onsite
    ) {
      return [];
    }
  }

  // We always pin the platform to Anaplan: this is the launch-only platform,
  // and it's what the entire site promises. If we ever open up to Pigment
  // etc., this is the line to revisit.
  const cutoffMs = opts.since
    ? Date.parse(opts.since)
    : Date.now() - ONE_WEEK_MS;
  const cutoffIso = Number.isNaN(cutoffMs)
    ? new Date(Date.now() - ONE_WEEK_MS).toISOString()
    : new Date(cutoffMs).toISOString();

  // Two SQL trips when the candidate is authorized in both countries — the
  // public query path doesn't support an OR over country today, and that's
  // a fine cost given the cron runs weekly per candidate.
  const all: JobListItem[] = [];
  for (const country of eligibleCountries) {
    const jobs = await getOpenJobs({
      platform: "anaplan",
      country,
    });
    all.push(...jobs);
  }

  // De-dupe across the two country queries (a global remote role might
  // technically appear under both, depending on how it's listed; we keep
  // the first occurrence).
  const seen = new Set<string>();
  const unique = all.filter((j) => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });

  const fresh = unique.filter((j) => {
    if (!j.published_at) return false;
    if (Date.parse(j.published_at) <= Date.parse(cutoffIso)) return false;
    if (opts.excludeJobIds.has(j.id)) return false;
    if (!acceptedRemote.has(j.remote_policy)) return false;
    return true;
  });

  // Featured listings float to the top of the digest, then by recency.
  // getOpenJobs already returns featured-first, but our cross-country merge
  // can re-disturb that order, so we re-sort here.
  fresh.sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    const at = a.published_at ? Date.parse(a.published_at) : 0;
    const bt = b.published_at ? Date.parse(b.published_at) : 0;
    return bt - at;
  });

  return fresh.slice(0, opts.limit);
}
