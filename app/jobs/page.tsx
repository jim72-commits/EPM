import type { Metadata } from "next";

import { JobAlertCta } from "@/app/jobs/job-alert-cta";
import { JobList } from "@/app/jobs/job-list";
import { JobsFilterBar } from "@/app/jobs/jobs-filter-bar";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { getOpenJobs, getTaxonomy } from "@/lib/jobs-queries";
import {
  countActiveFilters,
  parseJobSearchParams,
} from "@/lib/jobs-url";

export const metadata: Metadata = {
  title: "Open roles",
  description:
    "Browse open roles at companies running Anaplan, across the United States and Canada. Every listing requires hands-on Anaplan experience.",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JobsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const requestedFilters = parseJobSearchParams(raw);
  const { platforms, role_families } = await getTaxonomy();

  // Soft-validate platform/role slugs against the taxonomy. If a hand-typed
  // URL points at a slug we don't know, drop that filter and surface a quiet
  // notice rather than silently returning zero rows.
  const platformSlugs = new Set(platforms.map((p) => p.slug));
  const roleSlugs = new Set(role_families.map((r) => r.slug));
  const invalidPlatform =
    requestedFilters.platform != null &&
    !platformSlugs.has(requestedFilters.platform);
  const invalidRole =
    requestedFilters.role != null && !roleSlugs.has(requestedFilters.role);

  const filters = { ...requestedFilters };
  if (invalidPlatform) delete filters.platform;
  if (invalidRole) delete filters.role;

  const jobs = await getOpenJobs(filters);
  const activeFilterCount = countActiveFilters(filters);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16 lg:px-8">
      {!isSupabaseConfigured() ? (
        <p className="border border-hairline bg-surface px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted">
          Development mode: sample listings. Add{" "}
          <code className="font-mono text-[11px] normal-case text-foreground">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="font-mono text-[11px] normal-case text-foreground">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          to use your database after ship.
        </p>
      ) : null}

      <div className={!isSupabaseConfigured() ? "mt-8" : ""}>
        <div className="border-b border-hairline pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Directory · Anaplan only
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Open roles at companies running Anaplan
          </h1>
          <p className="mt-2 text-sm text-muted">
            United States and Canada. Every listing requires hands-on
            Anaplan experience — no generalist roles, no unrelated
            postings.
          </p>
        </div>

        {invalidPlatform || invalidRole ? (
          <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-xs text-muted">
            We didn&apos;t recognize the{" "}
            {invalidPlatform && invalidRole
              ? "platform or role"
              : invalidPlatform
                ? "platform"
                : "role"}{" "}
            filter — showing all matching roles instead.
          </p>
        ) : null}

        <JobsFilterBar platforms={platforms} roleFamilies={role_families} />

        <JobList jobs={jobs} hasFilters={activeFilterCount > 0} />

        <JobAlertCta filters={filters} />
      </div>
    </main>
  );
}
