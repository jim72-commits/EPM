import { requireOrgMember } from "@/lib/auth/employer";

import { EmployerJobForm } from "../employer-job-form";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmployerNewJobPage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const welcome = sp.welcome === "1";
  const { supabase } = await requireOrgMember(orgSlug);

  const [platforms, roleFamilies] = await Promise.all([
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

  const platformOptions = (platforms.data ?? []) as {
    id: string;
    name: string;
    slug: string;
  }[];
  const roleFamilyOptions = (roleFamilies.data ?? []) as {
    id: string;
    name: string;
    slug: string;
  }[];

  return (
    <div className="py-6">
      <header className="border-b border-hairline pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New draft
        </h1>
        <p className="mt-2 text-sm text-muted">
          Fill in your role. Drafts stay private until you publish.
        </p>
      </header>

      {welcome ? (
        <div className="mt-6 border border-hairline bg-surface px-5 py-4">
          <p className="text-sm text-foreground">
            Welcome to the circle. Your company workspace is ready — describe
            your first role below.
          </p>
        </div>
      ) : null}
      <EmployerJobForm
        orgSlug={orgSlug}
        platforms={platformOptions}
        roleFamilies={roleFamilyOptions}
        defaultValues={{
          slug: "",
          title: "",
          primary_platform_id: platformOptions[0]?.id ?? "",
          role_family_id: roleFamilyOptions[0]?.id ?? "",
          country_code: "US",
          location_label: "",
          remote_policy: "remote",
          employment_type: "full_time",
          summary: "",
          full_description: "",
        }}
      />
    </div>
  );
}
