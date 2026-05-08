"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCandidate } from "@/lib/auth/candidate";
import { captureException, logEvent } from "@/lib/observability";

/**
 * Candidate-initiated withdraw. RLS allows this from non-terminal statuses
 * (submitted, under_review, shortlisted). Terminal statuses (rejected,
 * hired, withdrawn) are left alone.
 */
export async function withdrawApplication(applicationId: string) {
  const { user, supabase } = await requireCandidate();

  const { data: app, error: fetchErr } = await supabase
    .from("job_applications")
    .select("id, status, job_id")
    .eq("id", applicationId)
    .eq("candidate_user_id", user.id)
    .maybeSingle();

  if (fetchErr || !app) {
    redirect("/me/applications?error=not_found");
  }

  if (!["submitted", "under_review", "shortlisted"].includes(app.status)) {
    redirect(
      `/me/applications/${applicationId}?error=${encodeURIComponent(
        "This application can no longer be withdrawn.",
      )}`,
    );
  }

  const { error: updateErr } = await supabase
    .from("job_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId);

  if (updateErr) {
    captureException(updateErr, { scope: "applications.withdraw", applicationId });
    redirect(
      `/me/applications/${applicationId}?error=${encodeURIComponent(updateErr.message)}`,
    );
  }

  logEvent("application_withdrawn", {
    application_id: applicationId,
    candidate_user_id: user.id,
    job_id: app.job_id,
  });

  revalidatePath("/me/applications");
  revalidatePath(`/me/applications/${applicationId}`);
  redirect(`/me/applications/${applicationId}?withdrew=1`);
}
