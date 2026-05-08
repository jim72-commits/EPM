import "server-only";

import { getAppBaseUrl } from "@/lib/app-url";
import { captureException } from "@/lib/observability";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

import { sendTransactional } from "./send";
import {
  applicationHiredEmail,
  applicationRejectedEmail,
  applicationShortlistedEmail,
  listingClosedEmail,
} from "./status-templates";

type StatusEmailKind =
  | "shortlisted"
  | "rejected_pre_close"
  | "hired_on_close"
  | "closed_hired_elsewhere"
  | "closed_no_hire"
  | "closed_cancelled"
  // Sent to non-hired applicants of a `hired_here` close. Distinct from
  // closed_no_hire so we don't tell candidates the role wasn't filled when
  // it was.
  | "closed_moved_forward_with_other";

type NotifyArgs = {
  applicationId: string;
  candidateUserId: string;
  jobTitle: string;
  organizationName: string;
  kind: StatusEmailKind;
};

/**
 * Look up a candidate's email via the auth admin API. Requires the service
 * role; returns null when the role isn't configured (dev / preview without
 * Supabase) so callers can no-op cleanly.
 */
async function fetchCandidateContact(userId: string): Promise<{
  email: string | null;
  fullName: string | null;
}> {
  if (!isServiceRoleAvailable()) {
    return { email: null, fullName: null };
  }
  try {
    const svc = createServiceRoleSupabaseClient();
    const [{ data: authData }, { data: profileRow }] = await Promise.all([
      svc.auth.admin.getUserById(userId),
      svc
        .from("candidate_profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return {
      email: authData.user?.email ?? null,
      fullName:
        (profileRow?.full_name as string | undefined)?.trim() || null,
    };
  } catch (err) {
    captureException(err, { scope: "notify_candidate.fetch_contact" });
    return { email: null, fullName: null };
  }
}

/**
 * Send a status-change email to a single candidate. Best-effort: any failure
 * is captured and swallowed so it never blocks the surrounding state change.
 *
 * `under_review` is intentionally not in the kind enum — moving someone into
 * review isn't a strong enough signal to warrant an email, and the badge on
 * /me/applications is sufficient.
 */
export async function notifyCandidateStatusChange(args: NotifyArgs): Promise<void> {
  try {
    const contact = await fetchCandidateContact(args.candidateUserId);
    if (!contact.email) return;

    const candidateName = contact.fullName ?? "there";
    const baseUrl = getAppBaseUrl();
    const applicationUrl = `${baseUrl}/me/applications/${args.applicationId}`;

    const common = {
      candidateName,
      jobTitle: args.jobTitle,
      organizationName: args.organizationName,
      applicationUrl,
    };

    let payload;
    switch (args.kind) {
      case "shortlisted":
        payload = applicationShortlistedEmail(common);
        break;
      case "rejected_pre_close":
        payload = applicationRejectedEmail(common);
        break;
      case "hired_on_close":
        payload = applicationHiredEmail(common);
        break;
      case "closed_hired_elsewhere":
        payload = listingClosedEmail({ ...common, kind: "hired_elsewhere" });
        break;
      case "closed_no_hire":
        payload = listingClosedEmail({ ...common, kind: "not_hired_no_fit" });
        break;
      case "closed_cancelled":
        payload = listingClosedEmail({ ...common, kind: "not_hired_cancelled" });
        break;
      case "closed_moved_forward_with_other":
        payload = listingClosedEmail({
          ...common,
          kind: "moved_forward_with_other",
        });
        break;
      default: {
        const exhaustive: never = args.kind;
        captureException(
          new Error(`Unknown status email kind: ${String(exhaustive)}`),
          { scope: "notify_candidate.kind" },
        );
        return;
      }
    }

    await sendTransactional({ to: contact.email, ...payload });
  } catch (err) {
    captureException(err, {
      scope: "notify_candidate.send",
      kind: args.kind,
      application_id: args.applicationId,
    });
  }
}

export type InFlightApplicant = {
  applicationId: string;
  candidateUserId: string;
};

/**
 * Fan-out helper for a listing-close event. Caller must capture the set of
 * still-in-flight applications BEFORE the outcome insert (the DB trigger
 * auto-rejects them, so reading back post-insert can't distinguish them
 * from pre-existing rejections).
 *
 *  - The hire (if any) gets `hired_on_close`.
 *  - Everyone else in `inFlight` gets a "listing closed" notice keyed to
 *    the outcome bucket.
 *
 * Already-rejected and already-withdrawn candidates are NEVER re-notified —
 * they received the appropriate email at the original transition time (or,
 * for withdrawn, never needed one).
 */
export async function notifyListingClosed(args: {
  jobTitle: string;
  organizationName: string;
  outcome:
    | "hired_here"
    | "hired_elsewhere"
    | "not_hired_cancelled"
    | "not_hired_no_fit";
  hiredApplicationId: string | null;
  inFlight: InFlightApplicant[];
}): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (args.outcome === "hired_here" && args.hiredApplicationId) {
    const hired = args.inFlight.find(
      (r) => r.applicationId === args.hiredApplicationId,
    );
    if (hired) {
      tasks.push(
        notifyCandidateStatusChange({
          applicationId: hired.applicationId,
          candidateUserId: hired.candidateUserId,
          jobTitle: args.jobTitle,
          organizationName: args.organizationName,
          kind: "hired_on_close",
        }),
      );
    }
  }

  // Pick a "closed" kind based on outcome. `hired_here` non-winners get a
  // dedicated kind so the email body doesn't claim the role went unfilled
  // (closed_no_hire) and doesn't claim it was filled off-platform
  // (closed_hired_elsewhere) — both would be misleading.
  let closedKind: StatusEmailKind;
  switch (args.outcome) {
    case "hired_here":
      closedKind = "closed_moved_forward_with_other";
      break;
    case "hired_elsewhere":
      closedKind = "closed_hired_elsewhere";
      break;
    case "not_hired_no_fit":
      closedKind = "closed_no_hire";
      break;
    case "not_hired_cancelled":
      closedKind = "closed_cancelled";
      break;
    default: {
      const exhaustive: never = args.outcome;
      captureException(
        new Error(`Unknown outcome: ${String(exhaustive)}`),
        { scope: "notify_listing_closed.outcome" },
      );
      return;
    }
  }

  for (const r of args.inFlight) {
    if (r.applicationId === args.hiredApplicationId) continue;
    tasks.push(
      notifyCandidateStatusChange({
        applicationId: r.applicationId,
        candidateUserId: r.candidateUserId,
        jobTitle: args.jobTitle,
        organizationName: args.organizationName,
        kind: closedKind,
      }),
    );
  }

  try {
    await Promise.all(tasks);
  } catch (err) {
    captureException(err, { scope: "notify_listing_closed.fanout" });
  }
}
