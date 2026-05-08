"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrgMember } from "@/lib/auth/employer";
import { friendlyDbError } from "@/lib/db-errors";
import {
  notifyListingClosed,
  type InFlightApplicant,
} from "@/lib/email/notify-candidate";
import { captureException, logEvent } from "@/lib/observability";

const OUTCOMES = [
  "hired_here",
  "hired_elsewhere",
  "not_hired_cancelled",
  "not_hired_no_fit",
] as const;

const closeSchema = z
  .object({
    outcome: z.enum(OUTCOMES),
    hired_application_id: z.string().uuid().nullable(),
    feedback: z.string().max(4000).nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.outcome === "hired_here" && !val.hired_application_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hired_application_id"],
        message: "Pick which applicant you hired.",
      });
    }
    if (val.outcome !== "hired_here" && val.hired_application_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hired_application_id"],
        message:
          "Hire attribution only applies when you hired through TheCOE.",
      });
    }
  });

function errorRedirect(
  orgSlug: string,
  jobId: string,
  message: string,
  carry?: { outcome?: string; hired_application_id?: string; feedback?: string },
): never {
  const sp = new URLSearchParams();
  sp.set("error", message);
  // Round-trip the user's input on validation/db error so the textarea and
  // chosen radio buttons rehydrate. Without this, picking the wrong outcome
  // and hitting Submit nukes a 4,000-character feedback field on the way back.
  if (carry?.outcome) sp.set("f_outcome", carry.outcome);
  if (carry?.hired_application_id) {
    sp.set("f_hired_application_id", carry.hired_application_id);
  }
  if (carry?.feedback) sp.set("f_feedback", carry.feedback);
  redirect(`/employer/${orgSlug}/jobs/${jobId}/close?${sp.toString()}`);
}

/**
 * Close a listing with an outcome verdict. The DB trigger flips the job to
 * `filled`, marks the chosen application `hired` (or moves all in-flight
 * applications to `rejected` for non-hire outcomes). One outcome row per job
 * is enforced by the unique constraint on `job_id`.
 */
export async function closeJobWithOutcome(
  orgSlug: string,
  jobId: string,
  formData: FormData,
) {
  const { user, supabase, org } = await requireOrgMember(orgSlug);

  const rawOutcome = String(formData.get("outcome") ?? "").trim();
  const rawHire = String(formData.get("hired_application_id") ?? "").trim();
  const rawFeedback = String(formData.get("feedback") ?? "").trim();

  const carryFields = {
    outcome: rawOutcome || undefined,
    hired_application_id: rawHire || undefined,
    feedback: rawFeedback || undefined,
  };

  const parsed = closeSchema.safeParse({
    outcome: rawOutcome,
    hired_application_id: rawHire.length ? rawHire : null,
    feedback: rawFeedback.length ? rawFeedback : null,
  });

  if (!parsed.success) {
    errorRedirect(
      orgSlug,
      jobId,
      parsed.error.issues[0]?.message ?? "Invalid input.",
      carryFields,
    );
  }

  const { outcome, hired_application_id, feedback } = parsed.data;

  const { data: job } = await supabase
    .from("jobs")
    .select("id, organization_id, status, listing_kind, title")
    .eq("id", jobId)
    .maybeSingle();

  if (!job || job.organization_id !== org.id) {
    errorRedirect(orgSlug, jobId, "Job not found.");
  }
  if (job.listing_kind !== "employer") {
    errorRedirect(
      orgSlug,
      jobId,
      "Only listings you posted on TheCOE can be closed here.",
    );
  }
  if (job.status === "filled") {
    errorRedirect(orgSlug, jobId, "This listing is already closed.");
  }
  // Only `open` listings can be closed with an outcome. The DB trigger
  // unconditionally promotes the job to `filled` on outcome insert, so
  // letting `draft` or `unpublished` rows through here would fabricate a
  // hire signal for a listing that was never live.
  if (job.status !== "open") {
    errorRedirect(
      orgSlug,
      jobId,
      "You can only close listings that are currently open. Publish it first or contact support.",
    );
  }

  // If the employer claims to have hired through us, double-check the chosen
  // application actually belongs to this job. RLS would block the foreign-org
  // case, but explicit validation gives us a clean error message.
  if (outcome === "hired_here" && hired_application_id) {
    const { data: app } = await supabase
      .from("job_applications")
      .select("id, job_id, status")
      .eq("id", hired_application_id)
      .maybeSingle();

    if (!app || app.job_id !== jobId) {
      errorRedirect(
        orgSlug,
        jobId,
        "Selected applicant doesn't belong to this listing.",
        carryFields,
      );
    }
    if (app.status === "withdrawn") {
      errorRedirect(
        orgSlug,
        jobId,
        "That candidate withdrew — pick someone else.",
        carryFields,
      );
    }
  }

  // Already-existing outcome means the listing was closed once and we don't
  // re-close. Catch this proactively so the user sees a clean message rather
  // than a unique-constraint error.
  const { data: existingOutcome } = await supabase
    .from("job_outcomes")
    .select("id")
    .eq("job_id", jobId)
    .maybeSingle();

  if (existingOutcome) {
    errorRedirect(orgSlug, jobId, "This listing already has a recorded outcome.");
  }

  // Capture in-flight applicants BEFORE the outcome insert. The DB trigger
  // auto-rejects them on insert, so a post-insert read can't tell them apart
  // from rows that were rejected days ago. We only want to notify candidates
  // whose applications were still open at the moment of close.
  const { data: inFlightRows, error: inFlightErr } = await supabase
    .from("job_applications")
    .select("id, candidate_user_id, status")
    .eq("job_id", jobId)
    .in("status", ["submitted", "under_review", "shortlisted"]);

  if (inFlightErr) {
    captureException(inFlightErr, {
      scope: "employer.close_listing.fetch_inflight",
      job_id: jobId,
    });
    // Non-fatal: we'd rather close the listing than block on a notify
    // pre-fetch. inFlightRows will be null and we'll fall through with empty.
  }

  const inFlight: InFlightApplicant[] = (inFlightRows ?? []).map((r) => ({
    applicationId: r.id as string,
    candidateUserId: r.candidate_user_id as string,
  }));

  const { error: insertErr } = await supabase.from("job_outcomes").insert({
    job_id: jobId,
    organization_id: org.id,
    outcome,
    hired_application_id,
    feedback,
    closed_by_user_id: user.id,
  });

  if (insertErr) {
    captureException(insertErr, {
      scope: "employer.close_listing",
      job_id: jobId,
      organization_id: org.id,
    });
    errorRedirect(
      orgSlug,
      jobId,
      friendlyDbError(insertErr, { context: "job" }),
      carryFields,
    );
  }

  logEvent("listing_closed", {
    job_id: jobId,
    organization_id: org.id,
    outcome,
    hired_application_id,
    closed_by_user_id: user.id,
    inflight_count: inFlight.length,
  });

  // Fan out the appropriate notice to every candidate the close affected.
  // Failures inside the helper are captured but never rethrown.
  try {
    await notifyListingClosed({
      jobTitle: job.title as string,
      organizationName: org.name,
      outcome,
      hiredApplicationId: hired_application_id,
      inFlight,
    });
  } catch (err) {
    captureException(err, {
      scope: "employer.close_listing.notify",
      job_id: jobId,
    });
  }

  revalidatePath(`/employer/${orgSlug}/jobs`);
  revalidatePath(`/employer/${orgSlug}/jobs/${jobId}/applicants`);
  revalidatePath("/jobs");
  revalidatePath("/admin/outcomes");
  redirect(`/employer/${orgSlug}/jobs?closed=1`);
}
