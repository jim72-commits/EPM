import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { formatPublishedDate } from "@/lib/format-job";

type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  listing_kind: string;
  created_at: string;
  organizations: { name: string } | { name: string }[] | null;
  platforms: { name: string } | { name: string }[] | null;
};

type ApplicationCountRow = {
  job_id: string;
  status: string;
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 50;
const ACTIVE_STATUSES = ["submitted", "under_review", "shortlisted"] as const;

export default async function AdminJobsPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const error =
    typeof sp.error === "string" ? sp.error : undefined;

  const pageRaw = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const {
    data,
    error: qError,
    count: totalJobs,
  } = await supabase
    .from("jobs")
    .select(
      `
      id,
      slug,
      title,
      status,
      listing_kind,
      created_at,
      organizations ( name ),
      platforms ( name )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const rows = qError ? [] : ((data ?? []) as Row[]);

  // Pull application status rows for just the jobs on this page so the
  // counts column doesn't trigger N+1 queries. We aggregate in memory by
  // (job_id, status) which is cheap for a 50-row page.
  const jobIds = rows.map((r) => r.id);
  let countsByJob = new Map<string, { active: number; total: number }>();
  if (jobIds.length > 0) {
    const { data: appRows } = await supabase
      .from("job_applications")
      .select("job_id, status")
      .in("job_id", jobIds);
    const apps = (appRows ?? []) as ApplicationCountRow[];
    countsByJob = apps.reduce<Map<string, { active: number; total: number }>>(
      (acc, row) => {
        const cur = acc.get(row.job_id) ?? { active: 0, total: 0 };
        cur.total += 1;
        if ((ACTIVE_STATUSES as readonly string[]).includes(row.status)) {
          cur.active += 1;
        }
        acc.set(row.job_id, cur);
        return acc;
      },
      new Map(),
    );
  }

  const totalRows = totalJobs ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Jobs
          </h1>
          <p className="mt-2 text-sm text-muted">
            Create and edit listings. Public site shows only{" "}
            <code className="font-mono text-xs">open</code> roles.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin/organizations/new"
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
          >
            New organization
          </Link>
          <Link
            href="/admin/jobs/new"
            className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.1em] text-on-accent hover:bg-accent-hover"
          >
            New job
          </Link>
        </div>
      </div>

      {saved ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Saved.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {qError ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {qError.message}
        </p>
      ) : null}

      {!qError && rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No jobs yet.</p>
      ) : null}
      {!qError && rows.length > 0 ? (
        <>
          <div className="mt-10 overflow-x-auto border border-hairline bg-surface">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Org</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Applicants</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const org = first(job.organizations);
                  const pl = first(job.platforms);
                  const c = countsByJob.get(job.id) ?? {
                    active: 0,
                    total: 0,
                  };
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-hairline last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {job.title}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {org?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {pl?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {job.listing_kind}
                      </td>
                      <td className="px-4 py-3 text-muted">{job.status}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {c.total === 0 ? (
                          <span className="text-muted">0</span>
                        ) : (
                          <>
                            {c.active}
                            <span className="text-muted">/{c.total}</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatPublishedDate(job.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/jobs/${job.id}/edit`}
                          className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span>
              Showing {offset + 1}–
              {Math.min(offset + rows.length, totalRows)} of {totalRows}
            </span>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
              Active / total = applicants in submitted, under_review, or
              shortlisted vs. all-time.
            </p>
            <div className="flex items-center gap-3">
              {hasPrev ? (
                <Link
                  href={`/admin/jobs?page=${page - 1}`}
                  className="border border-hairline px-3 py-2 font-medium uppercase tracking-[0.1em] hover:border-foreground hover:text-foreground"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="border border-hairline/40 px-3 py-2 font-medium uppercase tracking-[0.1em] text-muted/60">
                  ← Previous
                </span>
              )}
              <span className="font-medium uppercase tracking-[0.1em]">
                Page {page} of {totalPages}
              </span>
              {hasNext ? (
                <Link
                  href={`/admin/jobs?page=${page + 1}`}
                  className="border border-hairline px-3 py-2 font-medium uppercase tracking-[0.1em] hover:border-foreground hover:text-foreground"
                >
                  Next →
                </Link>
              ) : (
                <span className="border border-hairline/40 px-3 py-2 font-medium uppercase tracking-[0.1em] text-muted/60">
                  Next →
                </span>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
