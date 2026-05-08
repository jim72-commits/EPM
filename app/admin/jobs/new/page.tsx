import Link from "next/link";

import { JobForm, type JobFormDefaults } from "@/app/admin/jobs/job-form";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminNewJobPage() {
  const { supabase } = await requireAdmin();

  const [orgs, pl, rf] = await Promise.all([
    supabase.from("organizations").select("id,name,slug").order("name"),
    supabase.from("platforms").select("id,name,slug").order("sort_order"),
    supabase.from("role_families").select("id,name,slug").order("sort_order"),
  ]);

  const organizations = orgs.data ?? [];
  const platforms = pl.data ?? [];
  const roleFamilies = rf.data ?? [];

  const firstOrgId = organizations[0]?.id ?? "";
  const firstPlatformId = platforms[0]?.id ?? "";
  const firstRoleId = roleFamilies[0]?.id ?? "";

  const defaults: JobFormDefaults = {
    organization_id: firstOrgId,
    slug: "",
    title: "",
    primary_platform_id: firstPlatformId,
    role_family_id: firstRoleId,
    country_code: "US",
    location_label: "",
    remote_policy: "remote",
    employment_type: "full_time",
    listing_kind: "employer",
    status: "draft",
    summary: "",
    full_description: "",
    external_apply_url: "",
    is_featured: false,
    featured_until: "",
  };

  return (
    <div>
      <div className="border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New job
        </h1>
      </div>
      {organizations.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          Create an{" "}
          <Link href="/admin/organizations/new" className="text-accent underline">
            organization
          </Link>{" "}
          before posting a job.
        </p>
      ) : (
        <JobForm
          defaultValues={defaults}
          organizations={organizations}
          platforms={platforms}
          roleFamilies={roleFamilies}
          activeApplicationsCount={0}
        />
      )}
    </div>
  );
}
