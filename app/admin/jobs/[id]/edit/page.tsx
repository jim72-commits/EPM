import Link from "next/link";
import { notFound } from "next/navigation";

import { JobForm, type JobFormDefaults } from "@/app/admin/jobs/job-form";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata = {
  robots: { index: false, follow: false },
};

const ACTIVE_APP_STATUSES = [
  "submitted",
  "under_review",
  "shortlisted",
] as const;

type JobRow = {
  id: string;
  slug: string;
  title: string;
  primary_platform_id: string;
  role_family_id: string;
  organization_id: string;
  country_code: "US" | "CA";
  location_label: string | null;
  remote_policy: JobFormDefaults["remote_policy"];
  employment_type: JobFormDefaults["employment_type"];
  listing_kind: JobFormDefaults["listing_kind"];
  status: JobFormDefaults["status"];
  summary: string | null;
  full_description: string | null;
  external_apply_url: string | null;
  is_featured: boolean | null;
  featured_until: string | null;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminEditJobPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const error =
    typeof sp.error === "string" ? sp.error : undefined;

  const [orgs, pl, rf, jobRes] = await Promise.all([
    supabase.from("organizations").select("id,name,slug").order("name"),
    supabase.from("platforms").select("id,name,slug").order("sort_order"),
    supabase.from("role_families").select("id,name,slug").order("sort_order"),
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
  ]);

  const job = jobRes.data as JobRow | null;
  if (!job) notFound();

  // Count in-flight applications so the form can warn before unpublishing a
  // listing with applicants waiting on a response. We only count statuses
  // that represent unresolved candidate exposure — hired/rejected/withdrawn
  // applicants have already been told the outcome.
  const { count: activeApplicationsCount } = await supabase
    .from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id)
    .in("status", ACTIVE_APP_STATUSES as unknown as string[]);

  const organizations = orgs.data ?? [];
  const platforms = pl.data ?? [];
  const roleFamilies = rf.data ?? [];

  const defaults: JobFormDefaults = {
    id: job.id,
    organization_id: job.organization_id,
    slug: job.slug,
    title: job.title,
    primary_platform_id: job.primary_platform_id,
    role_family_id: job.role_family_id,
    country_code: job.country_code,
    location_label: job.location_label ?? "",
    remote_policy: job.remote_policy,
    employment_type: job.employment_type,
    listing_kind: job.listing_kind,
    status: job.status,
    summary: job.summary ?? "",
    full_description: job.full_description ?? "",
    external_apply_url: job.external_apply_url ?? "",
    is_featured: Boolean(job.is_featured),
    featured_until: job.featured_until
      ? job.featured_until.slice(0, 10)
      : "",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Edit job
        </h1>
        {job.status === "open" ? (
          <Link
            href={`/jobs/${job.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
          >
            Public listing
          </Link>
        ) : (
          <span className="text-xs uppercase tracking-[0.12em] text-muted">
            Public URL when status is open
          </span>
        )}
      </div>
      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      <JobForm
        defaultValues={defaults}
        organizations={organizations}
        platforms={platforms}
        roleFamilies={roleFamilies}
        activeApplicationsCount={activeApplicationsCount ?? 0}
      />
    </div>
  );
}
