import { redirect } from "next/navigation";

import { requireOrgMember } from "@/lib/auth/employer";

import { EmployerJobForm } from "../../employer-job-form";
import { submitJobForReview } from "../../actions";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const editErrors: Record<string, string> = {
  locked: "This listing is live or in review and not editable here.",
  not_found: "Job not found.",
};

export default async function EmployerEditJobPage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug, id } = await params;
  const sp = await searchParams;
  const errKey = typeof sp.error === "string" ? sp.error : undefined;
  const errMessage = errKey && editErrors[errKey] ? editErrors[errKey] : errKey;
  const { supabase, org } = await requireOrgMember(orgSlug);

  const [jobRes, platforms, roleFamilies] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        `
          id,
          slug,
          title,
          primary_platform_id,
          role_family_id,
          country_code,
          location_label,
          remote_policy,
          employment_type,
          listing_kind,
          status,
          summary,
          full_description,
          moderation_note,
          organization_id
        `,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("platforms")
      .select("id,name,slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("role_families")
      .select("id,name,slug")
      .order("sort_order", { ascending: true }),
  ]);

  if (!jobRes.data) {
    redirect(`/employer/${orgSlug}/jobs?error=not_found`);
  }

  const job = jobRes.data as {
    id: string;
    slug: string;
    title: string;
    primary_platform_id: string;
    role_family_id: string;
    country_code: "US" | "CA";
    location_label: string | null;
    remote_policy: "remote" | "hybrid" | "onsite" | "flexible";
    employment_type: "full_time" | "part_time" | "contract";
    listing_kind: "employer" | "syndicated";
    status:
      | "draft"
      | "pending_review"
      | "open"
      | "filled"
      | "unpublished"
      | "rejected";
    summary: string | null;
    full_description: string | null;
    moderation_note: string | null;
    organization_id: string;
  };

  if (job.organization_id !== org.id) {
    redirect(`/employer/${orgSlug}/jobs?error=not_found`);
  }
  // Editable states: draft (first pass), unpublished (paused listing being
  // refreshed), rejected (employer is reworking after moderator feedback).
  // Anything else (open / pending_review / filled) is locked.
  if (
    job.listing_kind !== "employer" ||
    !["draft", "unpublished", "rejected"].includes(job.status)
  ) {
    redirect(`/employer/${orgSlug}/jobs?error=locked`);
  }

  const boundSubmit = submitJobForReview.bind(null, orgSlug);

  return (
    <div className="py-6">
      <header className="border-b border-hairline pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {job.status === "rejected" ? "Edit and resubmit" : "Edit draft"}
        </h1>
        {job.status === "rejected" && job.moderation_note ? (
          <p className="mt-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-medium">Moderator note:</span>{" "}
            {job.moderation_note}
          </p>
        ) : null}
      </header>

      {errMessage ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {errMessage}
        </p>
      ) : null}

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-hairline bg-surface px-5 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            {job.status === "rejected" ? "Resubmit for review" : "Submit for review"}
          </p>
          <p className="mt-2 text-sm text-foreground">
            Posting on TheCOE is{" "}
            <span className="font-semibold text-accent">free</span>. Listings
            go through a quick moderation pass — usually under a business day.
          </p>
          <p className="mt-2 text-xs text-muted">
            We approve listings that are clear, specific, and Anaplan-relevant.
          </p>
        </div>
        <form action={boundSubmit}>
          <input type="hidden" name="id" value={job.id} />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
          >
            {job.status === "rejected"
              ? "Resubmit for review"
              : "Submit for review"}
          </button>
        </form>
      </section>

      <EmployerJobForm
        orgSlug={orgSlug}
        platforms={(platforms.data ?? []) as { id: string; name: string; slug: string }[]}
        roleFamilies={(roleFamilies.data ?? []) as { id: string; name: string; slug: string }[]}
        defaultValues={{
          id: job.id,
          slug: job.slug,
          title: job.title,
          primary_platform_id: job.primary_platform_id,
          role_family_id: job.role_family_id,
          country_code: job.country_code,
          location_label: job.location_label ?? "",
          remote_policy: job.remote_policy,
          employment_type: job.employment_type,
          summary: job.summary ?? "",
          full_description: job.full_description ?? "",
        }}
      />
    </div>
  );
}
