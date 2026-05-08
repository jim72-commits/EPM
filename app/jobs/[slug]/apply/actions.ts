"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { isProfileApplyReady, requireCandidate } from "@/lib/auth/candidate";
import { friendlyDbError } from "@/lib/db-errors";
import {
  applicationReceivedEmail,
  newApplicantEmail,
} from "@/lib/email/application-templates";
import { sendTransactional } from "@/lib/email/send";
import { captureException, logEvent } from "@/lib/observability";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * Pull the lowercase extension off a storage path. Returns null when there's
 * no extension or the candidate file is suspiciously named.
 */
function extractExtension(path: string): string | null {
  const idx = path.lastIndexOf(".");
  if (idx < 0 || idx === path.length - 1) return null;
  const ext = path.slice(idx + 1).toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return null;
  return ext;
}

function errorRedirect(slug: string, message: string): never {
  redirect(`/jobs/${slug}/apply?error=${encodeURIComponent(message)}`);
}

const applySchema = z.object({
  cover_letter: z.string().max(5000).nullable(),
});

/**
 * Soft daily cap on submissions per candidate. A real human applying with
 * intent rarely fires more than ~10 in a day; 30 is high enough to never
 * block legit power-users while still catching mass-apply scripts.
 */
const DAILY_APPLICATION_CAP = 30;

/**
 * Submit an application for a paid, open job. Runs under the candidate's
 * session for all writes we can RLS (insert + storage copy) and only falls
 * back to service role for cross-user email lookups.
 */
export async function submitApplication(slug: string, formData: FormData) {
  const { user, profile, supabase } = await requireCandidate();

  if (!isProfileApplyReady(profile)) {
    redirect("/me/profile?error=complete_profile_first");
  }

  const parsed = applySchema.safeParse({
    cover_letter: emptyToNull(formData.get("cover_letter")),
  });
  if (!parsed.success) {
    errorRedirect(slug, parsed.error.issues[0]?.message ?? "Invalid cover letter");
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        status,
        listing_kind,
        organization_id,
        organizations ( name )
      `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (jobErr || !job) {
    errorRedirect(slug, "Job not found");
  }
  if (job.status !== "open" || job.listing_kind !== "employer") {
    errorRedirect(slug, "This role is not accepting applications on TheCOE.");
  }

  const orgRel = job.organizations as
    | { name: string }
    | { name: string }[]
    | null;
  const orgNode = Array.isArray(orgRel) ? orgRel[0] : orgRel;
  const orgName = orgNode?.name ?? "the hiring team";

  // Block duplicate applications regardless of status — simpler mental model
  // than allowing reapplies after withdraw. If a candidate really needs to
  // reapply, an admin can clear the row.
  const { data: existing } = await supabase
    .from("job_applications")
    .select("id, status")
    .eq("job_id", job.id)
    .eq("candidate_user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.status === "withdrawn") {
      // Use a structured error code so the apply page can render a real
      // mailto link instead of bare text. SUPPORT_EMAIL stays the source of
      // truth on the page side.
      redirect(`/jobs/${slug}/apply?error=withdrawn_reapply`);
    }
    redirect(`/me/applications/${existing.id}?already_applied=1`);
  }

  // Daily-cap guard. We count the candidate's applications submitted in the
  // last 24 hours regardless of current status (including withdrawn) — the
  // cap is about protecting the system from mass-apply scripts, not about
  // counting "live" applications.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: capErr } = await supabase
    .from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("candidate_user_id", user.id)
    .gte("applied_at", since);

  if (capErr) {
    captureException(capErr, { scope: "apply.daily_cap_check" });
    // Fail open — a count failure shouldn't lock anyone out. The dup-check
    // above is the main correctness guard.
  } else if ((recentCount ?? 0) >= DAILY_APPLICATION_CAP) {
    logEvent("application_daily_cap_hit", {
      candidate_user_id: user.id,
      slug,
      recent_count: recentCount,
    });
    errorRedirect(
      slug,
      `You've applied to ${DAILY_APPLICATION_CAP} roles in the last 24 hours — give it some time before sending more.`,
    );
  }

  // Freeze the resume into an application-scoped path so later profile edits
  // cannot mutate what the employer sees.
  const applicationId = crypto.randomUUID();

  if (!profile.resume_path) {
    errorRedirect(slug, "Upload a resume before applying.");
  }

  // Reuse the original file's extension instead of hard-coding .pdf, so if
  // upload validation is ever loosened the snapshot path stays accurate.
  const sourceExt = extractExtension(profile.resume_path) ?? "pdf";
  const snapshotPath = `${user.id}/applications/${applicationId}.${sourceExt}`;

  const { error: copyErr } = await supabase.storage
    .from("candidate-resumes")
    .copy(profile.resume_path, snapshotPath);

  if (copyErr) {
    captureException(copyErr, { scope: "apply.copy_resume", slug });
    errorRedirect(slug, "Could not stage your resume. Try again.");
  }

  // Freeze profile + credentials into a JSON snapshot.
  const { data: credentials } = await supabase
    .from("candidate_credentials")
    .select(
      "credential_type, title, organization_name, start_date, end_date, description, sort_order",
    )
    .eq("user_id", user.id);

  const profileSnapshot = {
    full_name: profile.full_name,
    headline: profile.headline,
    country_code: profile.country_code,
    location_label: profile.location_label,
    work_auth_us: profile.work_auth_us,
    work_auth_ca: profile.work_auth_ca,
    years_experience_anaplan: profile.years_experience_anaplan,
    open_to_remote: profile.open_to_remote,
    open_to_hybrid: profile.open_to_hybrid,
    open_to_onsite: profile.open_to_onsite,
    linkedin_url: profile.linkedin_url,
    portfolio_url: profile.portfolio_url,
    bio: profile.bio,
    credentials: credentials ?? [],
    applicant_email: user.email,
  };

  const { error: insertErr } = await supabase.from("job_applications").insert({
    id: applicationId,
    job_id: job.id,
    candidate_user_id: user.id,
    status: "submitted",
    cover_letter: parsed.data.cover_letter,
    resume_snapshot_path: snapshotPath,
    profile_snapshot: profileSnapshot,
  });

  if (insertErr) {
    captureException(insertErr, { scope: "apply.insert", slug });
    // Best-effort cleanup of the staged resume so we don't leak orphans.
    await supabase.storage.from("candidate-resumes").remove([snapshotPath]);
    errorRedirect(
      slug,
      friendlyDbError(insertErr, { context: "application" }),
    );
  }

  logEvent("application_submitted", {
    application_id: applicationId,
    job_id: job.id,
    candidate_user_id: user.id,
  });

  // Fire-and-forget notifications. Failures here never block the redirect.
  try {
    await sendApplicationEmails({
      jobId: job.id,
      jobTitle: job.title,
      jobSlug: job.slug,
      organizationId: job.organization_id,
      organizationName: orgName,
      applicationId,
      candidateEmail: user.email ?? null,
      candidateName: profile.full_name,
      candidateHeadline: profile.headline,
    });
  } catch (err) {
    captureException(err, { scope: "apply.notifications", slug });
  }

  revalidatePath("/me/applications");
  revalidatePath(`/jobs/${slug}`);
  redirect(`/me/applications/${applicationId}?submitted=1`);
}

type NotifyArgs = {
  jobId: string;
  jobTitle: string;
  jobSlug: string;
  organizationId: string;
  organizationName: string;
  applicationId: string;
  candidateEmail: string | null;
  candidateName: string;
  candidateHeadline: string | null;
};

async function sendApplicationEmails(args: NotifyArgs): Promise<void> {
  const baseUrl = getAppBaseUrl();

  if (args.candidateEmail) {
    const email = applicationReceivedEmail({
      candidateName: args.candidateName,
      jobTitle: args.jobTitle,
      organizationName: args.organizationName,
      applicationUrl: `${baseUrl}/me/applications/${args.applicationId}`,
    });
    await sendTransactional({ to: args.candidateEmail, ...email });
  }

  if (!isServiceRoleAvailable()) {
    return;
  }

  // Employer notifications require service-role lookups: we join through
  // organization_members to auth.users to get one email per member.
  const svc = createServiceRoleSupabaseClient();

  const { data: orgSlugRow } = await svc
    .from("organizations")
    .select("slug")
    .eq("id", args.organizationId)
    .maybeSingle();

  const orgSlug = orgSlugRow?.slug ?? "";

  const { data: members } = await svc
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", args.organizationId);

  if (!members || members.length === 0) return;

  const memberEmails = (
    await Promise.all(
      members.map(async (m) => {
        const { data } = await svc.auth.admin.getUserById(m.user_id);
        return data.user?.email ?? null;
      }),
    )
  ).filter((e): e is string => typeof e === "string" && e.length > 0);

  if (memberEmails.length === 0) return;

  const applicantsUrl = orgSlug
    ? `${baseUrl}/employer/${orgSlug}/jobs/${args.jobId}/applicants`
    : `${baseUrl}/employer`;

  const template = newApplicantEmail({
    jobTitle: args.jobTitle,
    organizationName: args.organizationName,
    candidateName: args.candidateName,
    candidateHeadline: args.candidateHeadline,
    applicantsUrl,
  });

  await Promise.all(
    memberEmails.map((to) => sendTransactional({ to, ...template })),
  );
}
