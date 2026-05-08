import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/auth/employer";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

type ApplicationRow = {
  id: string;
  status: string;
  applied_at: string;
  status_updated_at: string;
  profile_snapshot: Record<string, unknown> | null;
};

const STATUS_FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "new", label: "New", statuses: ["submitted"] },
  { key: "review", label: "In review", statuses: ["under_review"] },
  { key: "shortlisted", label: "Shortlisted", statuses: ["shortlisted"] },
  { key: "hired", label: "Hired", statuses: ["hired"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
  { key: "withdrawn", label: "Withdrawn", statuses: ["withdrawn"] },
] as const;

function statusLabel(status: string): string {
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
    default:
      return status;
  }
}

function statusTone(status: string): string {
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
    default:
      return "border-hairline text-muted";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatYears(n: unknown): string {
  if (typeof n !== "number") return "—";
  if (n <= 0) return "None logged";
  return `${n} yr${n === 1 ? "" : "s"}`;
}

export default async function EmployerApplicantsPage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug, id: jobId } = await params;
  const sp = await searchParams;
  const filterKey = typeof sp.filter === "string" ? sp.filter : "all";

  const { supabase, org } = await requireOrgMember(orgSlug);

  const { data: job } = await supabase
    .from("jobs")
    .select("id, slug, title, status, published_at")
    .eq("id", jobId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!job) notFound();

  // Fetch all applications for the per-status counts, then filter in-page.
  const { data: allApps, error } = await supabase
    .from("job_applications")
    .select("id, status, applied_at, status_updated_at, profile_snapshot")
    .eq("job_id", jobId)
    .order("applied_at", { ascending: false });

  const rows = (allApps ?? []) as ApplicationRow[];

  const counts: Record<string, number> = {
    submitted: 0,
    under_review: 0,
    shortlisted: 0,
    rejected: 0,
    hired: 0,
    withdrawn: 0,
  };
  for (const r of rows) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filterKey) ?? STATUS_FILTERS[0];
  const activeStatuses: string[] | null = activeFilter.statuses
    ? [...activeFilter.statuses]
    : null;
  const visible = activeStatuses
    ? rows.filter((r) => activeStatuses.includes(r.status))
    : rows;

  const newCount = counts.submitted ?? 0;
  const reviewCount = counts.under_review ?? 0;
  const shortlistCount = counts.shortlisted ?? 0;
  const totalActive = newCount + reviewCount + shortlistCount;

  return (
    <div className="py-6">
      <Link
        href={`/employer/${orgSlug}/jobs`}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        All jobs
      </Link>

      <header className="mt-4 border-b border-hairline pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Applicants · {job.title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {rows.length} total · {totalActive} active ·{" "}
          {newCount} new · {shortlistCount} shortlisted
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          {job.status === "open" ? (
            <Link
              href={`/jobs/${job.slug}`}
              className="text-muted underline underline-offset-2 hover:text-foreground"
            >
              View listing
            </Link>
          ) : null}
          {job.status !== "open" ? (
            <Link
              href={`/employer/${orgSlug}/jobs/${job.id}/edit`}
              className="text-muted underline underline-offset-2 hover:text-foreground"
            >
              Edit listing
            </Link>
          ) : null}
          {job.status === "open" ? (
            <>
              <span className="text-muted">·</span>
              <Link
                href={`/employer/${orgSlug}/jobs/${job.id}/close`}
                className="text-muted underline underline-offset-2 hover:text-foreground"
              >
                Close listing
              </Link>
            </>
          ) : null}
          <span className="ml-auto text-muted">
            {job.status === "open"
              ? "Listing is live"
              : job.status === "filled"
                ? "Listing closed"
                : `Listing ${job.status}`}
          </span>
        </div>
      </header>

      <nav
        aria-label="Filter applicants"
        className="mt-6 flex flex-wrap items-center gap-2"
      >
        {STATUS_FILTERS.map((f) => {
          const count =
            f.statuses === null
              ? rows.length
              : f.statuses.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
          const active = f.key === activeFilter.key;
          return (
            <Link
              key={f.key}
              href={
                f.key === "all"
                  ? `/employer/${orgSlug}/jobs/${jobId}/applicants`
                  : `/employer/${orgSlug}/jobs/${jobId}/applicants?filter=${f.key}`
              }
              className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-hairline text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`tabular-nums ${active ? "text-background" : "text-foreground"}`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load applicants: {error.message}
        </p>
      ) : null}

      {!error && visible.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          {rows.length === 0
            ? "No applications yet. When candidates apply, they'll show up here."
            : "No applications match this filter."}
        </p>
      ) : null}

      {!error && visible.length > 0 ? (
        <div className="mt-8 overflow-x-auto border border-hairline bg-surface">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Anaplan yrs</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const snapshot = row.profile_snapshot ?? {};
                const name =
                  typeof snapshot.full_name === "string"
                    ? (snapshot.full_name as string)
                    : "Candidate";
                const headline =
                  typeof snapshot.headline === "string"
                    ? (snapshot.headline as string)
                    : null;
                const years =
                  typeof snapshot.years_experience_anaplan === "number"
                    ? (snapshot.years_experience_anaplan as number)
                    : null;
                const location =
                  typeof snapshot.location_label === "string" &&
                  snapshot.location_label
                    ? (snapshot.location_label as string)
                    : typeof snapshot.country_code === "string" &&
                        snapshot.country_code === "US"
                      ? "United States"
                      : typeof snapshot.country_code === "string" &&
                          snapshot.country_code === "CA"
                        ? "Canada"
                        : "—";
                return (
                  <tr
                    key={row.id}
                    className="border-b border-hairline align-top last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{name}</div>
                      {headline ? (
                        <div className="text-xs text-muted">{headline}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${statusTone(row.status)}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatYears(years)}</td>
                    <td className="px-4 py-3 text-muted">{location}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(row.applied_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/employer/${orgSlug}/jobs/${jobId}/applicants/${row.id}`}
                        className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-10 text-xs leading-relaxed text-muted">
        Applications come through a frozen profile snapshot — resume, headline,
        credentials and work-auth at the moment of apply. Candidates can
        withdraw before you decide; after that, their row stays put.
      </p>
    </div>
  );
}
