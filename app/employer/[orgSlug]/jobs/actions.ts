"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrgMember } from "@/lib/auth/employer";
import { friendlyDbError } from "@/lib/db-errors";
import { SUPPORT_EMAIL } from "@/lib/site";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

const employerJobSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug: lowercase letters, numbers, hyphens",
    ),
  title: z.string().min(1).max(300),
  primary_platform_id: z.string().uuid(),
  role_family_id: z.string().uuid(),
  country_code: z.enum(["US", "CA"]),
  location_label: z.string().max(300).nullable(),
  remote_policy: z.enum(["remote", "hybrid", "onsite", "flexible"]),
  employment_type: z.enum(["full_time", "part_time", "contract"]),
  // Optional one-line teaser shown above the full description on the
  // listing page and on cards. We allow up to 280 characters — same as
  // a tweet — to encourage tight, scannable copy.
  summary: z.string().max(280).nullable(),
  full_description: z.string().min(1, "Full description is required"),
});

export type UpsertEmployerJobFields = {
  slug: string;
  title: string;
  primary_platform_id: string;
  role_family_id: string;
  country_code: "US" | "CA";
  location_label: string;
  remote_policy: "remote" | "hybrid" | "onsite" | "flexible";
  employment_type: "full_time" | "part_time" | "contract";
  summary: string;
  full_description: string;
};

export type UpsertEmployerJobState = {
  error?: string;
  fields?: UpsertEmployerJobFields;
};

function readField(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function carryFields(formData: FormData): UpsertEmployerJobFields {
  // Round-trip whatever the user typed so re-rendering the form doesn't wipe
  // the textarea. Casts are safe because Zod will reject anything we can't
  // also re-render with `defaultValue`.
  const country = readField(formData, "country_code");
  const remote = readField(formData, "remote_policy");
  const employment = readField(formData, "employment_type");
  return {
    slug: readField(formData, "slug"),
    title: readField(formData, "title"),
    primary_platform_id: readField(formData, "primary_platform_id"),
    role_family_id: readField(formData, "role_family_id"),
    country_code: (country === "CA" ? "CA" : "US") as "US" | "CA",
    location_label: readField(formData, "location_label"),
    remote_policy:
      remote === "hybrid" || remote === "onsite" || remote === "flexible"
        ? (remote as UpsertEmployerJobFields["remote_policy"])
        : "remote",
    employment_type:
      employment === "part_time" || employment === "contract"
        ? (employment as UpsertEmployerJobFields["employment_type"])
        : "full_time",
    summary: readField(formData, "summary"),
    full_description: readField(formData, "full_description"),
  };
}

export async function upsertEmployerJob(
  _prevState: UpsertEmployerJobState,
  formData: FormData,
): Promise<UpsertEmployerJobState> {
  const orgSlugRaw = String(formData.get("org_slug") ?? "").trim();
  if (!orgSlugRaw) {
    return { error: "Missing organization context.", fields: carryFields(formData) };
  }

  const { supabase, org } = await requireOrgMember(orgSlugRaw);

  const rawId = String(formData.get("id") ?? "").trim();
  const id = rawId.length ? rawId : undefined;

  const parsed = employerJobSchema.safeParse({
    id,
    slug: formData.get("slug"),
    title: formData.get("title"),
    primary_platform_id: formData.get("primary_platform_id"),
    role_family_id: formData.get("role_family_id"),
    country_code: formData.get("country_code"),
    location_label: emptyToNull(formData.get("location_label")),
    remote_policy: formData.get("remote_policy"),
    employment_type: formData.get("employment_type"),
    summary: emptyToNull(formData.get("summary")),
    full_description: formData.get("full_description"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { error: msg, fields: carryFields(formData) };
  }

  const v = parsed.data;
  const row = {
    organization_id: org.id,
    slug: v.slug,
    title: v.title,
    primary_platform_id: v.primary_platform_id,
    role_family_id: v.role_family_id,
    country_code: v.country_code,
    location_label: v.location_label,
    remote_policy: v.remote_policy,
    employment_type: v.employment_type,
    listing_kind: "employer" as const,
    status: "draft" as const,
    summary: v.summary,
    full_description: v.full_description.trim(),
    external_apply_url: null,
  };

  if (v.id) {
    const { data: existing } = await supabase
      .from("jobs")
      .select("organization_id,status,listing_kind")
      .eq("id", v.id)
      .maybeSingle();

    if (!existing || existing.organization_id !== org.id) {
      return {
        error: "We couldn't find that listing in your organization.",
        fields: carryFields(formData),
      };
    }
    if (existing.listing_kind !== "employer") {
      return {
        error: "Employers can only edit listings they posted on TheCOE.",
        fields: carryFields(formData),
      };
    }
    if (existing.status === "open") {
      return {
        error: "Contact TheCOE to edit live listings.",
        fields: carryFields(formData),
      };
    }
    if (existing.status === "pending_review") {
      return {
        error:
          "This listing is in review. Wait for the moderator's decision before editing.",
        fields: carryFields(formData),
      };
    }

    const { error } = await supabase.from("jobs").update(row).eq("id", v.id);
    if (error) {
      return {
        error: friendlyDbError(error, {
          slug: v.slug,
          context: "job",
        }),
        fields: carryFields(formData),
      };
    }
  } else {
    const { error } = await supabase.from("jobs").insert(row);
    if (error) {
      return {
        error: friendlyDbError(error, {
          slug: v.slug,
          context: "job",
        }),
        fields: carryFields(formData),
      };
    }
  }

  revalidatePath(`/employer/${orgSlugRaw}/jobs`);
  redirect(`/employer/${orgSlugRaw}/jobs?saved=1`);
}

export async function setEmployerJobStatus(
  orgSlug: string,
  formData: FormData,
) {
  const { supabase, org } = await requireOrgMember(orgSlug);

  const id = String(formData.get("id") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();
  const redirectHint = String(formData.get("redirect") ?? "").trim();

  // Self-serve target states for this action (not the publish/submit path —
  // see submitJobForReview below). `filled` is owned by the close-listing
  // flow which records an outcome row.
  if (
    !id ||
    !["draft", "unpublished"].includes(nextStatus)
  ) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "That status change isn't supported. Refresh and try again.",
      )}`,
    );
  }

  const { data: existing } = await supabase
    .from("jobs")
    .select("organization_id,status")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.organization_id !== org.id) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "We couldn't find that listing in your organization.",
      )}`,
    );
  }

  // Guardrails on which transitions employers can self-serve:
  //   open           -> unpublished  (pause a live listing)
  //   draft         <-> unpublished  (manual housekeeping)
  //   rejected       -> draft        (rework a rejected listing before resubmit)
  //   pending_review -> draft        (withdraw a submission still in queue)
  // Anything else (e.g., flipping to/from `filled`, or moving directly to
  // `pending_review` here — that's submitJobForReview's job) is intentionally
  // out of scope for this action.
  const valid =
    (existing.status === "open" && nextStatus === "unpublished") ||
    (existing.status === "draft" && nextStatus === "unpublished") ||
    (existing.status === "unpublished" && nextStatus === "draft") ||
    (existing.status === "rejected" && nextStatus === "draft") ||
    (existing.status === "pending_review" && nextStatus === "draft");

  if (!valid) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        `That status change isn't supported here. Email ${SUPPORT_EMAIL} if you need help.`,
      )}`,
    );
  }

  const updates: { status: string; moderation_note?: null } = {
    status: nextStatus,
  };
  // Withdrawing a rejection clears the previous reason so the next submit
  // doesn't carry stale moderation context.
  if (existing.status === "rejected" && nextStatus === "draft") {
    updates.moderation_note = null;
  }

  const { error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", id);

  if (error) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        friendlyDbError(error, { context: "job" }),
      )}`,
    );
  }

  revalidatePath(`/employer/${orgSlug}/jobs`);
  revalidatePath("/jobs");
  if (redirectHint === "paused") {
    redirect(`/employer/${orgSlug}/jobs?paused=1`);
  }
  redirect(`/employer/${orgSlug}/jobs?saved=1`);
}

/**
 * Submit a draft (or a rejected listing the employer has reworked) for
 * admin moderation. This is the ad-supported successor to the old
 * Stripe-checkout publish path: we move the listing to `pending_review`
 * and let the admin queue decide whether it goes live.
 */
export async function submitJobForReview(
  orgSlug: string,
  formData: FormData,
) {
  const { supabase, org } = await requireOrgMember(orgSlug);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "Missing listing ID. Refresh and try again.",
      )}`,
    );
  }

  const { data: existing } = await supabase
    .from("jobs")
    .select("id, organization_id, status, listing_kind, full_description")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.organization_id !== org.id) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "We couldn't find that listing in your organization.",
      )}`,
    );
  }
  if (existing.listing_kind !== "employer") {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "Only listings posted on TheCOE can be submitted for review.",
      )}`,
    );
  }
  // Allow submission from draft (first time), unpublished (re-list a paused
  // role), or rejected (the moderator gave feedback and the employer has
  // reworked the listing). Block from `open`, `filled`, `pending_review`.
  if (
    existing.status !== "draft" &&
    existing.status !== "unpublished" &&
    existing.status !== "rejected"
  ) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        existing.status === "pending_review"
          ? "This listing is already in review."
          : existing.status === "open"
            ? "This listing is already live."
            : "Only drafts and rejected listings can be submitted for review.",
      )}`,
    );
  }
  const desc = (existing.full_description ?? "").trim();
  if (!desc.length) {
    redirect(
      `/employer/${orgSlug}/jobs/${existing.id}/edit?error=${encodeURIComponent(
        "Add a full description before submitting for review.",
      )}`,
    );
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      status: "pending_review",
      // Clear the previous rejection reason on resubmit so the queue
      // shows fresh context.
      moderation_note: null,
    })
    .eq("id", existing.id);

  if (error) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        friendlyDbError(error, { context: "job" }),
      )}`,
    );
  }

  revalidatePath(`/employer/${orgSlug}/jobs`);
  revalidatePath("/admin/moderation");

  redirect(`/employer/${orgSlug}/jobs/${existing.id}/submitted`);
}

export async function deleteEmployerDraft(
  orgSlug: string,
  formData: FormData,
) {
  const { supabase, org } = await requireOrgMember(orgSlug);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "Missing listing ID. Refresh and try again.",
      )}`,
    );
  }

  const { data: existing } = await supabase
    .from("jobs")
    .select("organization_id,status")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.organization_id !== org.id) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "We couldn't find that listing in your organization.",
      )}`,
    );
  }
  if (existing.status !== "draft") {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "Only drafts can be deleted.",
      )}`,
    );
  }

  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        friendlyDbError(error, { context: "job" }),
      )}`,
    );
  }

  revalidatePath(`/employer/${orgSlug}/jobs`);
  redirect(`/employer/${orgSlug}/jobs?saved=1`);
}
