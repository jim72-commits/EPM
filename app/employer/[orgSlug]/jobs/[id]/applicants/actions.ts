"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrgMember } from "@/lib/auth/employer";
import { friendlyDbError } from "@/lib/db-errors";
import { notifyCandidateStatusChange } from "@/lib/email/notify-candidate";
import { captureException, logEvent } from "@/lib/observability";

/**
 * Statuses an employer may set during Phase C. `hired` is reserved for the
 * close-listing flow in Phase D, and `withdrawn` is candidate-owned. We also
 * allow moving back to `under_review` so employers can reconsider a decision
 * before closing the listing.
 */
const EMPLOYER_SETTABLE = [
  "under_review",
  "shortlisted",
  "rejected",
] as const;

const updateStatusSchema = z.object({
  application_id: z.string().uuid(),
  status: z.enum(EMPLOYER_SETTABLE),
});

const updateNotesSchema = z.object({
  application_id: z.string().uuid(),
  employer_notes: z.string().max(4000).nullable(),
});

function applicantPath(orgSlug: string, jobId: string, appId: string): string {
  return `/employer/${orgSlug}/jobs/${jobId}/applicants/${appId}`;
}

function errorRedirect(target: string, message: string): never {
  redirect(`${target}?error=${encodeURIComponent(message)}`);
}

/**
 * Set an applicant status (move to review, shortlist, reject). RLS enforces
 * org membership via the job join, but we re-verify here so redirects are
 * clean and logs are honest.
 */
export async function setApplicantStatus(
  orgSlug: string,
  jobId: string,
  formData: FormData,
) {
  const { user, supabase, org } = await requireOrgMember(orgSlug);

  const parsed = updateStatusSchema.safeParse({
    application_id: formData.get("application_id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    errorRedirect(
      `/employer/${orgSlug}/jobs/${jobId}/applicants`,
      parsed.error.issues[0]?.message ?? "Invalid input",
    );
  }

  const { application_id, status } = parsed.data;

  // Re-check the application belongs to a job owned by this org, avoiding
  // an attack surface where a stray application_id from another org could
  // sneak in through a forged form post. We also pull job title + org name
  // here so the post-update notification doesn't need a second round-trip.
  const { data: app } = await supabase
    .from("job_applications")
    .select(
      `
        id,
        status,
        job_id,
        candidate_user_id,
        jobs!inner (
          organization_id,
          title,
          organizations ( name )
        )
      `,
    )
    .eq("id", application_id)
    .maybeSingle();

  const appJob = app
    ? (Array.isArray(app.jobs) ? app.jobs[0] : app.jobs)
    : null;
  if (!app || !appJob || appJob.organization_id !== org.id || app.job_id !== jobId) {
    errorRedirect(
      `/employer/${orgSlug}/jobs/${jobId}/applicants`,
      "Application not found.",
    );
  }

  if (app.status === "withdrawn" || app.status === "hired") {
    errorRedirect(
      applicantPath(orgSlug, jobId, application_id),
      `Can't change status of a ${app.status} application.`,
    );
  }

  const { error: updateErr } = await supabase
    .from("job_applications")
    .update({ status })
    .eq("id", application_id);

  if (updateErr) {
    captureException(updateErr, {
      scope: "employer.applicants.set_status",
      application_id,
    });
    errorRedirect(
      applicantPath(orgSlug, jobId, application_id),
      friendlyDbError(updateErr, { context: "application" }),
    );
  }

  logEvent("employer_application_status_changed", {
    application_id,
    job_id: jobId,
    organization_id: org.id,
    from_status: app.status,
    to_status: status,
    actor_user_id: user.id,
  });

  // Notify the candidate on meaningful transitions only. We skip
  // `under_review` (too noisy) and skip when the from-status already matches
  // the to-status (idempotent click).
  if (status !== app.status && (status === "shortlisted" || status === "rejected")) {
    const orgRel = (appJob as { organizations?: unknown }).organizations as
      | { name: string }
      | { name: string }[]
      | null
      | undefined;
    const orgNode = Array.isArray(orgRel) ? orgRel[0] : orgRel;
    const orgName = orgNode?.name ?? org.name;
    const jobTitle = (appJob as { title?: string }).title ?? "the role";

    await notifyCandidateStatusChange({
      applicationId: application_id,
      candidateUserId: app.candidate_user_id as string,
      jobTitle,
      organizationName: orgName,
      kind: status === "shortlisted" ? "shortlisted" : "rejected_pre_close",
    });
  }

  revalidatePath(`/employer/${orgSlug}/jobs/${jobId}/applicants`);
  revalidatePath(applicantPath(orgSlug, jobId, application_id));
  redirect(`${applicantPath(orgSlug, jobId, application_id)}?updated=1`);
}

/**
 * Auto-transition `submitted` -> `under_review` when an employer opens the
 * applicant detail for the first time. Keeps status signal honest without
 * forcing employers to click an extra button. Only fires when state is
 * exactly `submitted` — never regresses a shortlisted/rejected application.
 */
export async function markApplicantOpened(
  orgSlug: string,
  jobId: string,
  applicationId: string,
): Promise<void> {
  try {
    const { supabase, org } = await requireOrgMember(orgSlug);

    const { data: app } = await supabase
      .from("job_applications")
      .select("id, status, job_id, jobs!inner(organization_id)")
      .eq("id", applicationId)
      .maybeSingle();

    const appJob = app
      ? (Array.isArray(app.jobs) ? app.jobs[0] : app.jobs)
      : null;
    if (!app || !appJob || appJob.organization_id !== org.id || app.job_id !== jobId) {
      return;
    }
    if (app.status !== "submitted") return;

    const { error } = await supabase
      .from("job_applications")
      .update({ status: "under_review" })
      .eq("id", applicationId);

    if (error) {
      captureException(error, {
        scope: "employer.applicants.auto_review",
        applicationId,
      });
      return;
    }

    logEvent("employer_application_auto_review", {
      application_id: applicationId,
      job_id: jobId,
      organization_id: org.id,
    });
  } catch (err) {
    // Swallow — this is a silent UX nicety, not a required step.
    captureException(err, { scope: "employer.applicants.auto_review" });
  }
}

/**
 * Save or clear private employer notes on an application. Notes are never
 * exposed to the candidate; RLS keeps them employer/admin-only.
 */
export async function saveApplicantNotes(
  orgSlug: string,
  jobId: string,
  formData: FormData,
) {
  const { supabase, org } = await requireOrgMember(orgSlug);

  const rawNotes = formData.get("employer_notes");
  const normalized =
    typeof rawNotes === "string" && rawNotes.trim().length > 0
      ? rawNotes.trim()
      : null;

  const parsed = updateNotesSchema.safeParse({
    application_id: formData.get("application_id"),
    employer_notes: normalized,
  });

  if (!parsed.success) {
    errorRedirect(
      `/employer/${orgSlug}/jobs/${jobId}/applicants`,
      parsed.error.issues[0]?.message ?? "Invalid input",
    );
  }

  const { application_id, employer_notes } = parsed.data;

  const { data: app } = await supabase
    .from("job_applications")
    .select("id, job_id, jobs!inner(organization_id)")
    .eq("id", application_id)
    .maybeSingle();

  const appJob = app
    ? (Array.isArray(app.jobs) ? app.jobs[0] : app.jobs)
    : null;
  if (!app || !appJob || appJob.organization_id !== org.id || app.job_id !== jobId) {
    errorRedirect(
      `/employer/${orgSlug}/jobs/${jobId}/applicants`,
      "Application not found.",
    );
  }

  const { error: updateErr } = await supabase
    .from("job_applications")
    .update({ employer_notes })
    .eq("id", application_id);

  if (updateErr) {
    captureException(updateErr, {
      scope: "employer.applicants.save_notes",
      application_id,
    });
    errorRedirect(
      applicantPath(orgSlug, jobId, application_id),
      friendlyDbError(updateErr, { context: "application" }),
    );
  }

  revalidatePath(applicantPath(orgSlug, jobId, application_id));
  redirect(`${applicantPath(orgSlug, jobId, application_id)}?notes_saved=1`);
}
