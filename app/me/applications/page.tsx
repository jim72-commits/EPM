import Link from "next/link";

import { requireCandidate } from "@/lib/auth/candidate";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

type ApplicationRow = {
  id: string;
  status: string;
  applied_at: string;
  status_updated_at: string;
  jobs: {
    slug: string;
    title: string;
    organizations: { name: string } | { name: string }[] | null;
  } | { slug: string; title: string; organizations: unknown }[] | null;
};

function statusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "shortlisted":
      return "Shortlisted";
    case "rejected":
      return "Not moving forward";
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
    case "under_review":
      return "border-hairline text-foreground";
    case "shortlisted":
      return "border-accent text-accent";
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

const FILTER_GROUPS: ReadonlyArray<{
  id: "all" | "active" | "shortlisted" | "hired" | "closed";
  label: string;
  matches: (status: string) => boolean;
}> = [
  { id: "all", label: "All", matches: () => true },
  {
    id: "active",
    label: "Active",
    matches: (s) =>
      s === "submitted" || s === "under_review" || s === "shortlisted",
  },
  {
    id: "shortlisted",
    label: "Shortlisted",
    matches: (s) => s === "shortlisted",
  },
  { id: "hired", label: "Hired", matches: (s) => s === "hired" },
  {
    id: "closed",
    label: "Closed",
    matches: (s) => s === "rejected" || s === "withdrawn" || s === "hired",
  },
];

function pickQ(sp: Record<string, string | string[] | undefined>): string {
  const raw = sp.q;
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function pickFilter(
  sp: Record<string, string | string[] | undefined>,
): (typeof FILTER_GROUPS)[number]["id"] {
  const raw = sp.filter;
  const match = FILTER_GROUPS.find((g) => g.id === raw);
  return match?.id ?? "all";
}

export default async function CandidateApplicationsPage({
  searchParams,
}: PageProps) {
  const { user, supabase } = await requireCandidate();
  const sp = await searchParams;
  const errorMsg = typeof sp.error === "string" ? sp.error : null;
  const justVerified = sp.welcome === "verified";
  const q = pickQ(sp);
  const activeFilter = pickFilter(sp);

  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
        id,
        status,
        applied_at,
        status_updated_at,
        jobs (
          slug,
          title,
          organizations ( name )
        )
      `,
    )
    .eq("candidate_user_id", user.id)
    .order("applied_at", { ascending: false });

  const rows = (data ?? []) as ApplicationRow[];

  // We pull all of the candidate's applications and filter in memory.
  // Per-user history is small (rarely >100 rows), so this is cheaper and
  // simpler than juggling cross-table ilike filters through PostgREST.
  const filterGroup = FILTER_GROUPS.find((g) => g.id === activeFilter)!;
  const needle = q.toLowerCase();

  const decorated = rows.map((row) => {
    const jobNode = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    const jobSlug =
      jobNode && typeof jobNode === "object" && "slug" in jobNode
        ? (jobNode as { slug: string }).slug
        : null;
    const jobTitle =
      jobNode && typeof jobNode === "object" && "title" in jobNode
        ? (jobNode as { title: string }).title
        : "—";
    const orgsRaw =
      jobNode && typeof jobNode === "object" && "organizations" in jobNode
        ? (jobNode as { organizations: unknown }).organizations
        : null;
    const orgNode = Array.isArray(orgsRaw) ? orgsRaw[0] : orgsRaw;
    const orgName =
      orgNode && typeof orgNode === "object" && "name" in orgNode
        ? ((orgNode as { name: string }).name ?? "Employer")
        : "Employer";
    return { row, jobSlug, jobTitle, orgName };
  });

  const filtered = decorated.filter(({ row, jobTitle, orgName }) => {
    if (!filterGroup.matches(row.status)) return false;
    if (!needle) return true;
    return (
      jobTitle.toLowerCase().includes(needle) ||
      orgName.toLowerCase().includes(needle)
    );
  });

  const counts = {
    all: rows.length,
    active: rows.filter((r) =>
      ["submitted", "under_review", "shortlisted"].includes(r.status),
    ).length,
    shortlisted: rows.filter((r) => r.status === "shortlisted").length,
    hired: rows.filter((r) => r.status === "hired").length,
    closed: rows.filter((r) =>
      ["rejected", "withdrawn", "hired"].includes(r.status),
    ).length,
  } as const;

  function buildHref(next: { filter?: string; q?: string }): string {
    const params = new URLSearchParams();
    const filter = next.filter ?? activeFilter;
    const search = next.q ?? q;
    if (filter && filter !== "all") params.set("filter", filter);
    if (search) params.set("q", search);
    const qs = params.toString();
    return qs ? `/me/applications?${qs}` : "/me/applications";
  }

  return (
    <div className="py-6">
      <header className="border-b border-hairline pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Candidate
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Your applications
        </h1>
      </header>

      {justVerified ? (
        <div className="mt-6 border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
          <p className="font-medium">You&apos;re in. Welcome to the circle.</p>
          <p className="mt-1 text-xs text-green-800">
            Round out your profile so the apply button unlocks on every open
            role.{" "}
            <Link
              href="/me/profile"
              className="font-medium underline underline-offset-2 hover:text-green-700"
            >
              Finish your profile →
            </Link>
          </p>
        </div>
      ) : null}

      {errorMsg ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      {error ? (
        <p className="mt-10 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load applications: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-10">
          <p className="text-sm leading-relaxed text-muted">
            You haven&apos;t applied to any roles yet. When you do, this page
            will show each application, its status, and the frozen profile
            snapshot the employer received.
          </p>
          <p className="mt-8 text-xs uppercase tracking-[0.1em] text-muted">
            <Link
              href="/jobs"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Browse open roles
            </Link>
          </p>
        </div>
      ) : (
        <>
          <form
            method="GET"
            action="/me/applications"
            className="mt-8 flex flex-wrap items-end gap-3 border-b border-hairline pb-6"
          >
            <input type="hidden" name="filter" value={activeFilter} />
            <label className="min-w-0 flex-1">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Search
              </span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Title or company"
                className="mt-2 block w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center border border-transparent bg-foreground px-4 text-xs font-medium uppercase tracking-[0.1em] text-background hover:bg-accent hover:text-on-accent"
            >
              Search
            </button>
            {q ? (
              <Link
                href={buildHref({ q: "" })}
                className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
              >
                Clear
              </Link>
            ) : null}
          </form>

          <nav className="mt-6 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.12em]">
            {FILTER_GROUPS.map((group) => {
              const active = group.id === activeFilter;
              return (
                <Link
                  key={group.id}
                  href={buildHref({ filter: group.id })}
                  className={
                    active
                      ? "border border-foreground bg-foreground px-3 py-2 text-background"
                      : "border border-hairline px-3 py-2 text-muted hover:border-foreground hover:text-foreground"
                  }
                >
                  {group.label}
                  <span className="ml-2 tabular-nums text-[10px] opacity-80">
                    {counts[group.id]}
                  </span>
                </Link>
              );
            })}
          </nav>

          {filtered.length === 0 ? (
            <p className="mt-10 text-sm text-muted">
              {q
                ? `No applications match \u201C${q}\u201D.`
                : "No applications in this view."}
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-hairline border-y border-hairline">
              {filtered.map(({ row, jobSlug, jobTitle, orgName }) => (
                <li key={row.id}>
                  <Link
                    href={`/me/applications/${row.id}`}
                    className="block px-4 py-5 transition-colors hover:bg-surface"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-foreground">
                          {jobTitle}
                        </h2>
                        <p className="mt-1 text-sm text-muted">{orgName}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${statusTone(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                        <p className="mt-2 text-xs text-muted">
                          Applied {formatDate(row.applied_at)}
                        </p>
                      </div>
                    </div>
                    {jobSlug ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.1em] text-muted">
                        {jobSlug}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-10 text-xs uppercase tracking-[0.1em] text-muted">
        <Link
          href="/jobs"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Browse more roles
        </Link>
      </p>
    </div>
  );
}
