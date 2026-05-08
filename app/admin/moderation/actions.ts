"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { friendlyDbError } from "@/lib/db-errors";
import { captureException, logEvent } from "@/lib/observability";

const MODERATION_NOTE_MAX_LENGTH = 2000;

/**
 * Approve a pending listing: flip status to `open` and stamp `published_at`
 * if it isn't already set. Admin RLS on jobs allows this transition.
 */
export async function approveJob(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(
      `/admin/moderation?error=${encodeURIComponent(
        "Missing listing ID. Refresh and try again.",
      )}`,
    );
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, published_at, slug, title, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!job) {
    redirect(
      `/admin/moderation?error=${encodeURIComponent(
        "Listing not found.",
      )}`,
    );
  }
  if (job.status !== "pending_review") {
    redirect(
      `/admin/moderation?error=${encodeURIComponent(
        `Listing isn't in review (status: ${job.status}).`,
      )}`,
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "open",
      // Preserve the original publish timestamp for re-approvals; otherwise
      // stamp now so sort orders behave correctly.
      published_at: job.published_at ?? now,
      moderation_note: null,
    })
    .eq("id", job.id);

  if (error) {
    captureException(error, {
      scope: "moderation.approve",
      job_id: job.id,
      admin_user_id: user.id,
    });
    redirect(
      `/admin/moderation?error=${encodeURIComponent(
        friendlyDbError(error, { context: "job" }),
      )}`,
    );
  }

  logEvent("moderation_approved", {
    job_id: job.id,
    organization_id: job.organization_id,
    admin_user_id: user.id,
  });

  revalidatePath("/admin/moderation");
  revalidatePath(`/admin/jobs`);
  revalidatePath(`/jobs`);
  revalidatePath(`/jobs/${job.slug}`);

  redirect(`/admin/moderation?approved=${encodeURIComponent(job.title)}`);
}

/**
 * Reject a pending listing: flip status to `rejected` and persist a
 * moderator note that the employer will see when they reopen the listing.
 */
export async function rejectJob(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!id) {
    redirect(
      `/admin/moderation?error=${encodeURIComponent(
        "Missing listing ID. Refresh and try again.",
      )}`,
    );
  }
  if (!note) {
    redirect(
      `/admin/moderation/${id}?error=${encodeURIComponent(
        "Add a short note explaining what needs to change before rejecting.",
      )}`,
    );
  }
  if (note.length > MODERATION_NOTE_MAX_LENGTH) {
    redirect(
      `/admin/moderation/${id}?error=${encodeURIComponent(
        `Moderation note must be ${MODERATION_NOTE_MAX_LENGTH} characters or fewer.`,
      )}`,
    );
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, title, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!job) {
    redirect(
      `/admin/moderation?error=${encodeURIComponent(
        "Listing not found.",
      )}`,
    );
  }
  if (job.status !== "pending_review") {
    redirect(
      `/admin/moderation?error=${encodeURIComponent(
        `Listing isn't in review (status: ${job.status}).`,
      )}`,
    );
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      status: "rejected",
      moderation_note: note,
    })
    .eq("id", job.id);

  if (error) {
    captureException(error, {
      scope: "moderation.reject",
      job_id: job.id,
      admin_user_id: user.id,
    });
    redirect(
      `/admin/moderation/${id}?error=${encodeURIComponent(
        friendlyDbError(error, { context: "job" }),
      )}`,
    );
  }

  logEvent("moderation_rejected", {
    job_id: job.id,
    organization_id: job.organization_id,
    admin_user_id: user.id,
    note_length: note.length,
  });

  revalidatePath("/admin/moderation");
  revalidatePath(`/admin/jobs`);

  redirect(`/admin/moderation?rejected=${encodeURIComponent(job.title)}`);
}
