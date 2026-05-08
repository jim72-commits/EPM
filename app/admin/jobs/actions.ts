"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { friendlyDbError } from "@/lib/db-errors";
import { logEvent } from "@/lib/observability";
import { isValidPublicUrl } from "@/lib/url";

function emptyToNull(v: string): string | null {
  const s = v.trim();
  return s.length ? s : null;
}

const jobUpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    organization_id: z.string().uuid(),
    slug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers, hyphens"),
    title: z.string().min(1).max(300),
    primary_platform_id: z.string().uuid(),
    role_family_id: z.string().uuid(),
    country_code: z.enum(["US", "CA"]),
    location_label: z.string().max(300).nullable(),
    remote_policy: z.enum(["remote", "hybrid", "onsite", "flexible"]),
    employment_type: z.enum(["full_time", "part_time", "contract"]),
    listing_kind: z.enum(["employer", "syndicated"]),
    status: z.enum([
      "draft",
      "pending_review",
      "open",
      "filled",
      "unpublished",
      "rejected",
    ]),
    summary: z.string().nullable().optional(),
    full_description: z.string().nullable().optional(),
    external_apply_url: z.string().nullable().optional(),
    is_featured: z.boolean(),
    featured_until: z
      .string()
      .nullable()
      .refine(
        (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "featured_until must be YYYY-MM-DD",
      ),
  })
  .superRefine((val, ctx) => {
    if (val.listing_kind === "syndicated") {
      if (!val.summary?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Summary is required for syndicated listings",
          path: ["summary"],
        });
      }
      const url = val.external_apply_url?.trim();
      if (!url) {
        ctx.addIssue({
          code: "custom",
          message: "Apply URL is required for syndicated listings",
          path: ["external_apply_url"],
        });
      } else if (!isValidPublicUrl(url)) {
        ctx.addIssue({
          code: "custom",
          message: "Apply URL must be a full http:// or https:// URL.",
          path: ["external_apply_url"],
        });
      }
    }
    if (val.listing_kind === "employer" && !val.full_description?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Full description is required for employer-posted listings",
        path: ["full_description"],
      });
    }
  });

/**
 * Submitted-fields snapshot returned to the form when a save fails. Keeping
 * the raw user-entered values means an admin who typoed a slug doesn't lose
 * the rest of their work — the form rehydrates whatever they typed.
 */
export type UpsertJobFields = {
  organization_id: string;
  slug: string;
  title: string;
  primary_platform_id: string;
  role_family_id: string;
  country_code: string;
  location_label: string;
  remote_policy: string;
  employment_type: string;
  listing_kind: string;
  status: string;
  summary: string;
  full_description: string;
  external_apply_url: string;
  is_featured: boolean;
  featured_until: string;
};

export type UpsertJobState = {
  error?: string;
  fields?: UpsertJobFields;
};

function readFields(formData: FormData): UpsertJobFields {
  const get = (k: string) => String(formData.get(k) ?? "");
  return {
    organization_id: get("organization_id"),
    slug: get("slug"),
    title: get("title"),
    primary_platform_id: get("primary_platform_id"),
    role_family_id: get("role_family_id"),
    country_code: get("country_code"),
    location_label: get("location_label"),
    remote_policy: get("remote_policy"),
    employment_type: get("employment_type"),
    listing_kind: get("listing_kind"),
    status: get("status"),
    summary: get("summary"),
    full_description: get("full_description"),
    external_apply_url: get("external_apply_url"),
    is_featured: formData.get("is_featured") === "on",
    featured_until: get("featured_until"),
  };
}

export async function upsertJob(
  _prev: UpsertJobState,
  formData: FormData,
): Promise<UpsertJobState> {
  const { supabase, user: actor } = await requireAdmin();

  const fields = readFields(formData);
  const rawId = String(formData.get("id") ?? "").trim();
  const id = rawId.length ? rawId : undefined;

  const parsed = jobUpsertSchema.safeParse({
    id,
    organization_id: fields.organization_id,
    slug: fields.slug,
    title: fields.title,
    primary_platform_id: fields.primary_platform_id,
    role_family_id: fields.role_family_id,
    country_code: fields.country_code,
    location_label: emptyToNull(fields.location_label),
    remote_policy: fields.remote_policy,
    employment_type: fields.employment_type,
    listing_kind: fields.listing_kind,
    status: fields.status,
    summary: emptyToNull(fields.summary),
    full_description: emptyToNull(fields.full_description),
    external_apply_url: emptyToNull(fields.external_apply_url),
    is_featured: fields.is_featured,
    featured_until: emptyToNull(fields.featured_until),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { error: msg, fields };
  }

  const v = parsed.data;
  const row = {
    organization_id: v.organization_id,
    slug: v.slug,
    title: v.title,
    primary_platform_id: v.primary_platform_id,
    role_family_id: v.role_family_id,
    country_code: v.country_code,
    location_label: v.location_label,
    remote_policy: v.remote_policy,
    employment_type: v.employment_type,
    listing_kind: v.listing_kind,
    status: v.status,
    summary: v.listing_kind === "syndicated" ? v.summary?.trim() ?? null : null,
    full_description:
      v.listing_kind === "employer" ? v.full_description?.trim() ?? null : null,
    external_apply_url:
      v.listing_kind === "syndicated" ? v.external_apply_url?.trim() ?? null : null,
    is_featured: v.is_featured,
    // The form sends a YYYY-MM-DD string. We treat that as end-of-day UTC so
    // an admin entering "2026-12-31" doesn't see the promo expire mid-day on
    // their local clock. featured_until is meaningful only when is_featured
    // is true, but we don't auto-clear the value when toggling off — this
    // keeps the previously-set window so re-enabling later restores it.
    featured_until: v.featured_until
      ? new Date(`${v.featured_until}T23:59:59.999Z`).toISOString()
      : null,
  };

  if (v.id) {
    // Preserve listing-kind-inactive content across mode toggles. Without this,
    // flipping a paid listing to syndicated would null out full_description
    // (the form hides that field, so it submits empty), and flipping back
    // would have nothing to restore. We keep whatever the previous row
    // stored for the non-active kind so the data round-trips.
    const { data: existing } = await supabase
      .from("jobs")
      .select(
        "published_at, status, summary, full_description, external_apply_url",
      )
      .eq("id", v.id)
      .maybeSingle();

    // Soft block on destructive transitions that would strand applicants. The
    // canonical close path is the employer "Close with outcome" flow, which
    // notifies candidates and feeds analytics. If an admin really wants to
    // pull a listing without that, the form surfaces an explicit
    // acknowledgement checkbox.
    const previousStatus =
      (existing?.status as string | null | undefined) ?? null;
    const isStrandingTransition =
      previousStatus === "open" &&
      (v.status === "unpublished" || v.status === "draft");
    if (isStrandingTransition) {
      const ack = String(formData.get("ack_unpublish") ?? "") === "1";
      if (!ack) {
        const { count: activeCount } = await supabase
          .from("job_applications")
          .select("id", { count: "exact", head: true })
          .eq("job_id", v.id)
          .in("status", ["submitted", "under_review", "shortlisted"]);
        if ((activeCount ?? 0) > 0) {
          return {
            error: `This listing has ${activeCount} active application${
              activeCount === 1 ? "" : "s"
            }. Use Close with outcome from the employer dashboard, or check the acknowledge box and resave.`,
            fields,
          };
        }
      }
    }

    let published_at: string | null =
      (existing?.published_at as string | null | undefined) ?? null;
    if (v.status === "open" && !published_at) {
      published_at = new Date().toISOString();
    }

    const preservedSummary =
      (existing?.summary as string | null | undefined) ?? null;
    const preservedFullDesc =
      (existing?.full_description as string | null | undefined) ?? null;
    const preservedExternalApplyUrl =
      (existing?.external_apply_url as string | null | undefined) ?? null;

    const updateRow = {
      ...row,
      summary:
        v.listing_kind === "syndicated"
          ? v.summary?.trim() ?? null
          : preservedSummary,
      full_description:
        v.listing_kind === "employer"
          ? v.full_description?.trim() ?? null
          : preservedFullDesc,
      external_apply_url:
        v.listing_kind === "syndicated"
          ? v.external_apply_url?.trim() ?? null
          : preservedExternalApplyUrl,
      published_at,
    };

    const { error } = await supabase
      .from("jobs")
      .update(updateRow)
      .eq("id", v.id);

    if (error) {
      return {
        error: friendlyDbError(error, { context: "job", slug: v.slug }),
        fields,
      };
    }

    logEvent("admin.job_updated", {
      actor_user_id: actor.id,
      job_id: v.id,
      organization_id: v.organization_id,
      status: v.status,
      previous_status: previousStatus,
      listing_kind: v.listing_kind,
      slug: v.slug,
      published_at,
    });
  } else {
    const published_at =
      v.status === "open" ? new Date().toISOString() : null;

    const { data: inserted, error } = await supabase
      .from("jobs")
      .insert({
        ...row,
        published_at,
      })
      .select("id")
      .single();

    if (error) {
      return {
        error: friendlyDbError(error, { context: "job", slug: v.slug }),
        fields,
      };
    }

    logEvent("admin.job_created", {
      actor_user_id: actor.id,
      job_id: inserted?.id ?? null,
      organization_id: v.organization_id,
      status: v.status,
      listing_kind: v.listing_kind,
      slug: v.slug,
      published_at,
    });
  }

  revalidatePath("/jobs");
  revalidatePath("/jobs", "layout");
  revalidatePath("/admin/jobs");
  redirect("/admin/jobs?saved=1");
}
