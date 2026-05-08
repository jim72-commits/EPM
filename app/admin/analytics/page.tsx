import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

type TtfaRow = {
  job_id: string;
  job_title: string;
  job_slug: string;
  organization_id: string;
  role_family_id: string;
  job_status: "draft" | "open" | "filled" | "unpublished";
  published_at: string;
  first_applied_at: string | null;
  total_applicants: number;
  hours_to_first_applicant: number | null;
};

type FunnelRow = {
  role_family_id: string;
  role_family_slug: string;
  role_family_name: string;
  role_family_sort_order: number;
  published_jobs: number;
  total_applications: number;
  submitted: number;
  under_review: number;
  shortlisted: number;
  rejected: number;
  hired: number;
  withdrawn: number;
  hire_rate: number | string | null; // numeric in PG, may serialize as string
};

function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base];
  const hi = sorted[base + 1];
  if (lo === undefined) return null;
  if (hi === undefined) return lo;
  return lo + rest * (hi - lo);
}

function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes}m`;
  }
  if (hours < 48) {
    return `${hours.toFixed(1)}h`;
  }
  return `${(hours / 24).toFixed(1)}d`;
}

function formatPct(value: unknown): string {
  if (value == null) return "—";
  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (Number.isNaN(num)) return "—";
  return `${(num * 100).toFixed(0)}%`;
}

export default async function AdminAnalyticsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="mt-4 text-sm text-muted">
          Configure Supabase to see live analytics.
        </p>
      </div>
    );
  }

  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  // Three independent slices of the view:
  //  - aggregateRows: every published job, used for percentile math and the
  //    no-applicants triage list. Without this the global stats silently
  //    drift as the .limit(200) window rolls forward.
  //  - recentRows: capped at 20 for the "Recent jobs" table on this page.
  //  - funnelData: per-role-family aggregate.
  const [{ data: aggregateData }, { data: recentData }, { data: funnelData }] =
    await Promise.all([
      supabase
        .from("job_time_to_first_applicant")
        .select(
          "job_id, job_title, job_slug, organization_id, job_status, published_at, total_applicants, hours_to_first_applicant",
        ),
      supabase
        .from("job_time_to_first_applicant")
        .select(
          "job_id, job_title, job_slug, organization_id, role_family_id, job_status, published_at, first_applied_at, total_applicants, hours_to_first_applicant",
        )
        .order("published_at", { ascending: false })
        .limit(20),
      supabase
        .from("applicant_funnel_role_family")
        .select(
          "role_family_id, role_family_slug, role_family_name, role_family_sort_order, published_jobs, total_applications, submitted, under_review, shortlisted, rejected, hired, withdrawn, hire_rate",
        )
        .order("role_family_sort_order", { ascending: true }),
    ]);

  const aggregateRows = (aggregateData ?? []) as TtfaRow[];
  const recentRows = (recentData ?? []) as TtfaRow[];
  const funnelRows = (funnelData ?? []) as FunnelRow[];

  const hoursWithApplicants = aggregateRows
    .map((r) => r.hours_to_first_applicant)
    .filter((v): v is number => typeof v === "number");

  const p25 = quantile(hoursWithApplicants, 0.25);
  const p50 = quantile(hoursWithApplicants, 0.5);
  const p75 = quantile(hoursWithApplicants, 0.75);

  const jobsWithoutApplicants = aggregateRows
    .filter((r) => r.total_applicants === 0 && r.job_status === "open")
    .sort((a, b) => (b.published_at < a.published_at ? -1 : 1));

  // Resolve org names via a single fetch keyed by id, since the view stores
  // organization_id but not the name. Keeps the view skinny and
  // org-renames cheap (one table to update).
  const orgIds = Array.from(
    new Set([
      ...aggregateRows.map((r) => r.organization_id),
      ...recentRows.map((r) => r.organization_id),
    ]),
  );
  const orgNamesById = new Map<string, { name: string; slug: string }>();
  if (orgIds.length > 0) {
    const { data: orgRows } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .in("id", orgIds);
    for (const o of orgRows ?? []) {
      const row = o as { id: string; name: string; slug: string };
      orgNamesById.set(row.id, { name: row.name, slug: row.slug });
    }
  }

  return (
    <div className="py-10">
      <header className="border-b border-hairline pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Admin
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pulse on directory health: how fast jobs draw their first applicant,
          and how each role family converts through the funnel.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Time to first applicant
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Across all {aggregateRows.length} published job
          {aggregateRows.length === 1 ? "" : "s"}. Excludes jobs that never
          received an applicant from the percentile math — they&apos;re listed
          below for triage.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="P25" value={formatHours(p25)} />
          <Stat label="P50 (median)" value={formatHours(p50)} />
          <Stat label="P75" value={formatHours(p75)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          {hoursWithApplicants.length} job{hoursWithApplicants.length === 1 ? "" : "s"}{" "}
          contributed measurements. {jobsWithoutApplicants.length} open job
          {jobsWithoutApplicants.length === 1 ? "" : "s"} still waiting.
        </p>

        {jobsWithoutApplicants.length > 0 ? (
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Open jobs with no applicants yet
            </p>
            <ul className="mt-4 divide-y divide-hairline border border-hairline bg-surface">
              {jobsWithoutApplicants.slice(0, 12).map((row) => {
                const org = orgNamesById.get(row.organization_id);
                return (
                  <li
                    key={row.job_id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/jobs/${row.job_id}/edit`}
                        className="text-sm text-foreground hover:underline"
                      >
                        {row.job_title}
                      </Link>
                      <p className="mt-1 text-xs text-muted">
                        {org?.name ?? row.organization_id} · published{" "}
                        {new Date(row.published_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-muted">0 applicants</span>
                  </li>
                );
              })}
            </ul>
            {jobsWithoutApplicants.length > 12 ? (
              <p className="mt-3 text-xs text-muted">
                + {jobsWithoutApplicants.length - 12} more
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Recent jobs · time to first applicant
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border border-hairline bg-surface text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  <th className="border-b border-hairline px-4 py-3">Job</th>
                  <th className="border-b border-hairline px-4 py-3">Org</th>
                  <th className="border-b border-hairline px-4 py-3">Published</th>
                  <th className="border-b border-hairline px-4 py-3">First applicant</th>
                  <th className="border-b border-hairline px-4 py-3">Applicants</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((row) => {
                  const org = orgNamesById.get(row.organization_id);
                  return (
                    <tr key={row.job_id} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/jobs/${row.job_id}/edit`}
                          className="text-foreground hover:underline"
                        >
                          {row.job_title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {org?.name ?? row.organization_id}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(row.published_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatHours(row.hours_to_first_applicant)}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {row.total_applicants}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-16 border-t border-hairline pt-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Funnel by role family
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Hire rate excludes withdrawn applications. Role families with no
          applicants show as zeros so gaps are visible.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border border-hairline bg-surface text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-[0.12em] text-muted">
                <th className="border-b border-hairline px-4 py-3">Role family</th>
                <th className="border-b border-hairline px-4 py-3">Jobs</th>
                <th className="border-b border-hairline px-4 py-3">Total apps</th>
                <th className="border-b border-hairline px-4 py-3">Shortlisted</th>
                <th className="border-b border-hairline px-4 py-3">Hired</th>
                <th className="border-b border-hairline px-4 py-3">Hire rate</th>
              </tr>
            </thead>
            <tbody>
              {funnelRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-muted">
                    No data yet.
                  </td>
                </tr>
              ) : null}
              {funnelRows.map((row) => (
                <tr
                  key={row.role_family_id}
                  className="border-b border-hairline last:border-0"
                >
                  <td className="px-4 py-3 text-foreground">
                    {row.role_family_name}
                  </td>
                  <td className="px-4 py-3 text-muted">{row.published_jobs}</td>
                  <td className="px-4 py-3 text-muted">{row.total_applications}</td>
                  <td className="px-4 py-3 text-muted">{row.shortlisted}</td>
                  <td className="px-4 py-3 text-foreground">{row.hired}</td>
                  <td className="px-4 py-3 text-foreground">
                    {formatPct(row.hire_rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-hairline bg-surface px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
