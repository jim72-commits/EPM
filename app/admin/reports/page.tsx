import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

import { resolveListingReport } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listing reports",
  robots: { index: false, follow: false },
};

type Reason =
  | "spam"
  | "scam"
  | "misleading"
  | "off_topic"
  | "harassment"
  | "other";

type Status = "open" | "dismissed" | "actioned";

type ReportRow = {
  id: string;
  reason: Reason;
  details: string;
  status: Status;
  reporter_email: string | null;
  reporter_user_id: string | null;
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
  jobs: {
    id: string;
    slug: string;
    title: string;
    status: string;
    organizations: { name: string; slug: string } | null;
  } | null;
};

function reasonLabel(r: Reason): string {
  switch (r) {
    case "spam":
      return "Spam";
    case "scam":
      return "Scam";
    case "misleading":
      return "Misleading";
    case "off_topic":
      return "Off-topic";
    case "harassment":
      return "Harassment";
    case "other":
      return "Other";
  }
}

function statusTone(s: Status): string {
  switch (s) {
    case "open":
      return "border-amber-600 bg-amber-50 text-amber-800";
    case "dismissed":
      return "border-hairline text-muted";
    case "actioned":
      return "border-foreground text-foreground";
  }
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const FILTERS: ReadonlyArray<{ id: "open" | "all" | "resolved"; label: string }> = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

type PageProps = {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

const PAGE_SIZE = 50;

export default async function AdminReportsPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const filterRaw = typeof sp.filter === "string" ? sp.filter : "open";
  const activeFilter: "open" | "all" | "resolved" =
    filterRaw === "all"
      ? "all"
      : filterRaw === "resolved"
        ? "resolved"
        : "open";

  const pageRaw = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const errorMsg = typeof sp.error === "string" ? sp.error : null;
  const resolvedKind = typeof sp.resolved === "string" ? sp.resolved : null;

  let query = supabase
    .from("listing_reports")
    .select(
      `
        id,
        reason,
        details,
        status,
        reporter_email,
        reporter_user_id,
        admin_notes,
        resolved_at,
        resolved_by_user_id,
        created_at,
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
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (activeFilter === "open") {
    query = query.eq("status", "open");
  } else if (activeFilter === "resolved") {
    query = query.in("status", ["dismissed", "actioned"]);
  }

  const { data, error, count: totalForFilter } = await query;
  const rows = ((data ?? []) as unknown as ReportRow[]) ?? [];

  // Headline counts come from per-status aggregate queries, not by loading
  // every row. Three head:true requests in parallel keeps this cheap as the
  // table grows.
  const [
    { count: openCount },
    { count: dismissedCount },
    { count: actionedCount },
  ] = await Promise.all([
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "dismissed"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "actioned"),
  ]);

  const counts = {
    open: openCount ?? 0,
    dismissed: dismissedCount ?? 0,
    actioned: actionedCount ?? 0,
  };

  const totalRowsForFilter = totalForFilter ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRowsForFilter / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div>
      <div className="border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Listing reports
        </h1>
        <p className="mt-2 text-sm text-muted">
          Trust & safety queue. Reports never auto-action a listing — review
          and decide. Brigading shouldn&apos;t take down legit posts.
        </p>
      </div>

      {error ? (
        <p className="mt-6 border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          Failed to load reports: {error.message}
        </p>
      ) : null}

      {errorMsg ? (
        <p className="mt-6 border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          {errorMsg}
        </p>
      ) : null}

      {resolvedKind === "dismissed" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Report dismissed.
        </p>
      ) : null}

      {resolvedKind === "actioned" ? (
        <p className="mt-6 border border-foreground/20 bg-surface px-4 py-3 text-sm text-foreground">
          Report marked as actioned.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open" value={counts.open} accent={counts.open > 0} />
        <Stat label="Dismissed" value={counts.dismissed} />
        <Stat label="Actioned" value={counts.actioned} />
      </div>

      <nav className="mt-8 flex gap-3 text-xs font-medium uppercase tracking-[0.12em]">
        {FILTERS.map((f) => {
          const active = f.id === activeFilter;
          return (
            <Link
              key={f.id}
              href={`/admin/reports?filter=${f.id}`}
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
          <p className="text-sm text-muted">No reports in this view.</p>
        ) : (
          <>
            <ul className="divide-y divide-hairline border border-hairline bg-surface">
              {rows.map((r) => (
                <ReportItem key={r.id} report={r} />
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <span>
                Showing {offset + 1}–{Math.min(offset + rows.length, totalRowsForFilter)}{" "}
                of {totalRowsForFilter}
              </span>
              <div className="flex items-center gap-3">
                {hasPrev ? (
                  <Link
                    href={`/admin/reports?filter=${activeFilter}&page=${page - 1}`}
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
                    href={`/admin/reports?filter=${activeFilter}&page=${page + 1}`}
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

function ReportItem({ report }: { report: ReportRow }) {
  const job = report.jobs;
  const orgName = job?.organizations?.name ?? "—";
  return (
    <li className="px-4 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${statusTone(
              report.status,
            )}`}
          >
            {report.status}
          </span>
          <span className="border border-hairline bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            {reasonLabel(report.reason)}
          </span>
          <span className="text-sm font-medium text-foreground">
            {job ? job.title : "Listing missing"}
          </span>
          <span className="text-xs text-muted">{orgName}</span>
        </div>
        <span className="text-xs text-muted">
          {formatTimestamp(report.created_at)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {report.details}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        {job ? (
          <>
            <Link
              href={`/admin/jobs/${job.id}/edit`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Edit in admin
            </Link>
            <Link
              href={`/jobs/${job.slug}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              View public
            </Link>
          </>
        ) : null}
        {job?.organizations ? (
          <span>
            org{" "}
            <Link
              href={`/employers/${job.organizations.slug}`}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              /{job.organizations.slug}
            </Link>
          </span>
        ) : null}
        {report.reporter_email ? (
          <span>reporter: {report.reporter_email}</span>
        ) : null}
        {report.reporter_user_id ? (
          <span>signed-in reporter</span>
        ) : !report.reporter_email ? (
          <span>anonymous</span>
        ) : null}
      </div>

      {report.status !== "open" ? (
        <div className="mt-4 border-t border-hairline pt-4 text-xs text-muted">
          Resolved {report.resolved_at ? formatTimestamp(report.resolved_at) : ""}.{" "}
          {report.admin_notes ? (
            <>
              <span className="block mt-2 text-sm text-foreground whitespace-pre-wrap">
                {report.admin_notes}
              </span>
            </>
          ) : (
            "No admin notes recorded."
          )}
        </div>
      ) : (
        <form action={resolveListingReport} className="mt-4 border-t border-hairline pt-4">
          <input type="hidden" name="report_id" value={report.id} />
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Internal notes (optional)
            </span>
            <textarea
              name="admin_notes"
              rows={2}
              maxLength={4000}
              placeholder="Why this decision? Logged for audit, not shared with reporter."
              className="mt-2 block w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="submit"
              name="status"
              value="dismissed"
              className="inline-flex h-9 items-center justify-center border border-hairline px-4 text-xs font-medium uppercase tracking-[0.1em] text-muted hover:border-foreground hover:text-foreground"
            >
              Dismiss
            </button>
            <button
              type="submit"
              name="status"
              value="actioned"
              className="inline-flex h-9 items-center justify-center border border-foreground bg-foreground px-4 text-xs font-medium uppercase tracking-[0.1em] text-background hover:border-accent hover:bg-accent hover:text-on-accent"
            >
              Mark actioned
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "border border-foreground bg-foreground/5 px-4 py-4"
          : "border border-hairline bg-surface px-4 py-4"
      }
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
