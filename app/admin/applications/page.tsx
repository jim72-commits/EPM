import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { getUsersByIds } from "@/lib/admin/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "rejected"
  | "hired"
  | "withdrawn";

const STATUS_VALUES: readonly ApplicationStatus[] = [
  "submitted",
  "under_review",
  "shortlisted",
  "rejected",
  "hired",
  "withdrawn",
];

type FilterKey = "all" | "active" | ApplicationStatus;

const FILTERS: ReadonlyArray<{ id: FilterKey; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "submitted", label: "New" },
  { id: "under_review", label: "In review" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
  { id: "withdrawn", label: "Withdrawn" },
];

type Row = {
  id: string;
  status: ApplicationStatus;
  applied_at: string;
  status_updated_at: string;
  candidate_user_id: string;
  profile_snapshot: { full_name?: string; headline?: string | null } | null;
  jobs: {
    id: string;
    slug: string;
    title: string;
    status: string;
    organizations: { name: string; slug: string } | null;
  } | null;
};

const PAGE_SIZE = 50;

function statusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "submitted":
      return "New";
    case "under_review":
      return "In review";
    case "shortlisted":
      return "Shortlisted";
    case "rejected":
      return "Rejected";
    case "hired":
      return "Hired";
    case "withdrawn":
      return "Withdrawn";
  }
}

function statusTone(status: ApplicationStatus): string {
  switch (status) {
    case "submitted":
      return "border-accent text-accent";
    case "under_review":
      return "border-hairline text-foreground";
    case "shortlisted":
      return "border-accent bg-accent/5 text-accent";
    case "hired":
      return "border-green-600 text-green-700";
    case "rejected":
    case "withdrawn":
      return "border-hairline text-muted";
  }
}

function isApplicationStatus(v: string): v is ApplicationStatus {
  return (STATUS_VALUES as readonly string[]).includes(v);
}

function parseFilter(raw: string | undefined): FilterKey {
  if (!raw) return "all";
  if (raw === "all" || raw === "active") return raw;
  if (isApplicationStatus(raw)) return raw;
  return "all";
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

type PageProps = {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

export default async function AdminApplicationsPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const filterRaw = typeof sp.filter === "string" ? sp.filter : undefined;
  const activeFilter = parseFilter(filterRaw);

  const pageRaw = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("job_applications")
    .select(
      `
        id,
        status,
        applied_at,
        status_updated_at,
        candidate_user_id,
        profile_snapshot,
        jobs:job_id (
          id,
          slug,
          title,
          status,
          organizations:organization_id ( name, slug )
        )
      `,
      { count: "exact" },
    )
    .order("applied_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (activeFilter === "active") {
    query = query.in("status", ["submitted", "under_review", "shortlisted"]);
  } else if (activeFilter !== "all") {
    query = query.eq("status", activeFilter);
  }

  const { data, error, count: totalForFilter } = await query;
  const rows = ((data ?? []) as unknown as Row[]) ?? [];

  // Resolve emails for visible rows so admins triaging an issue can match a
  // candidate to their auth-side email without dropping into SQL. Limited to
  // page-visible rows to keep the auth.admin.listUsers cost bounded.
  const userIds = Array.from(new Set(rows.map((r) => r.candidate_user_id)));
  const users = await getUsersByIds(userIds);

  // Headline counts (active / hired) come from per-status aggregates rather
  // than the loaded page so they stay accurate as you flip filters.
  const [{ count: activeCount }, { count: hiredCount }, { count: totalCount }] =
    await Promise.all([
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "under_review", "shortlisted"]),
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "hired"),
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true }),
    ]);

  const counts = {
    active: activeCount ?? 0,
    hired: hiredCount ?? 0,
    total: totalCount ?? 0,
  };

  const totalRowsForFilter = totalForFilter ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRowsForFilter / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div>
      <div className="border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Applications
        </h1>
        <p className="mt-2 text-sm text-muted">
          Read-only view of every application across the marketplace. Use this
          to triage trust &amp; safety issues, ghosting complaints, and stuck
          candidates. Status changes still happen on the employer side.
        </p>
      </div>

      {error ? (
        <p className="mt-6 border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          Failed to load applications: {error.message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Active" value={counts.active} accent={counts.active > 0} />
        <Stat label="Hired through TheCOE" value={counts.hired} />
        <Stat label="All-time" value={counts.total} />
      </div>

      <nav className="mt-8 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.12em]">
        {FILTERS.map((f) => {
          const active = f.id === activeFilter;
          return (
            <Link
              key={f.id}
              href={`/admin/applications?filter=${f.id}`}
              className={
                active
                  ? "border border-foreground bg-foreground px-3 py-2 text-background"
                  : "border border-hairline px-3 py-2 text-muted hover:border-foreground hover:text-foreground"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No applications in this view.</p>
        ) : (
          <>
            <div className="overflow-x-auto border border-hairline bg-surface">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                    <th className="px-4 py-3 font-medium">Candidate</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Job</th>
                    <th className="px-4 py-3 font-medium">Applied</th>
                    <th className="px-4 py-3 font-medium text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const snap = row.profile_snapshot ?? {};
                    const name = snap.full_name?.trim() || "Candidate";
                    const headline = snap.headline?.trim() || null;
                    const email =
                      users.get(row.candidate_user_id)?.email ?? null;
                    const job = row.jobs;
                    const orgName = job?.organizations?.name ?? "—";
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-hairline align-top last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {name}
                          </div>
                          {headline ? (
                            <div className="text-xs text-muted">{headline}</div>
                          ) : null}
                          {email ? (
                            <div className="mt-1 font-mono text-[11px] text-muted">
                              {email}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${statusTone(row.status)}`}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {job?.title ?? "—"}
                          </div>
                          <div className="text-xs text-muted">{orgName}</div>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDate(row.applied_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/applications/${row.id}`}
                            className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                          >
                            Open
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
                {Math.min(offset + rows.length, totalRowsForFilter)} of{" "}
                {totalRowsForFilter}
              </span>
              <div className="flex items-center gap-3">
                {hasPrev ? (
                  <Link
                    href={`/admin/applications?filter=${activeFilter}&page=${page - 1}`}
                    className="border border-hairline px-3 py-2 font-medium uppercase tracking-[0.1em] hover:border-foreground hover:text-foreground"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="border border-hairline/40 px-3 py-2 font-medium uppercase tracking-[0.1em] text-muted/60">
                    ← Previous
                  </span>
                )}
                <span>
                  Page {page} of {totalPages}
                </span>
                {hasNext ? (
                  <Link
                    href={`/admin/applications?filter=${activeFilter}&page=${page + 1}`}
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
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div
      className={`border ${accent ? "border-foreground" : "border-hairline"} bg-surface px-4 py-5`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
