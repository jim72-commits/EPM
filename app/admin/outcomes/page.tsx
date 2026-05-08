import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listing outcomes",
  robots: { index: false, follow: false },
};

type OutcomeRow = {
  id: string;
  outcome:
    | "hired_here"
    | "hired_elsewhere"
    | "not_hired_cancelled"
    | "not_hired_no_fit";
  feedback: string | null;
  closed_at: string;
  hired_application_id: string | null;
  jobs: {
    id: string;
    slug: string;
    title: string;
    organizations: { name: string; slug: string } | null;
  } | null;
  hired_application:
    | {
        id: string;
        candidate_user_id: string;
        profile_snapshot: { full_name?: string } | null;
      }
    | null;
};

type RollupRow = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  total_closed: number;
  hired_here: number;
  hired_elsewhere: number;
  not_hired_no_fit: number;
  not_hired_cancelled: number;
  last_closed_at: string | null;
};

function outcomeLabel(o: OutcomeRow["outcome"]): string {
  switch (o) {
    case "hired_here":
      return "Hired here";
    case "hired_elsewhere":
      return "Hired elsewhere";
    case "not_hired_no_fit":
      return "Closed · no hire";
    case "not_hired_cancelled":
      return "Cancelled";
  }
}

function outcomeTone(o: OutcomeRow["outcome"]): string {
  switch (o) {
    case "hired_here":
      return "border-green-600 bg-green-50 text-green-800";
    case "hired_elsewhere":
      return "border-hairline bg-surface text-foreground";
    case "not_hired_no_fit":
      return "border-hairline text-muted";
    case "not_hired_cancelled":
      return "border-hairline text-muted";
  }
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

function pct(num: number, denom: number): string {
  if (denom <= 0) return "—";
  return `${Math.round((num / denom) * 1000) / 10}%`;
}

export default async function AdminOutcomesPage() {
  const { supabase } = await requireAdmin();

  const [{ data: outcomeRows }, { data: rollupRows }, { count: totalApps }] =
    await Promise.all([
      supabase
        .from("job_outcomes")
        .select(
          `
            id,
            outcome,
            feedback,
            closed_at,
            hired_application_id,
            jobs:job_id (
              id,
              slug,
              title,
              organizations:organization_id ( name, slug )
            ),
            hired_application:hired_application_id (
              id,
              candidate_user_id,
              profile_snapshot
            )
          `,
        )
        .order("closed_at", { ascending: false })
        .limit(200),
      supabase
        .from("org_outcome_rollups")
        .select("*")
        .order("total_closed", { ascending: false }),
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true }),
    ]);

  const outcomes = (outcomeRows ?? []) as unknown as OutcomeRow[];
  const rollups = (rollupRows ?? []) as RollupRow[];

  // Global totals come from the org rollup view (full counts), not the
  // .limit(200) recent-closes sample. Without this, headline stats and
  // conversion percentages silently capped at 200 once total closes
  // crossed that threshold.
  const totals = rollups.reduce(
    (acc, row) => {
      acc.total += row.total_closed;
      acc.hired_here += row.hired_here;
      acc.hired_elsewhere += row.hired_elsewhere;
      acc.not_hired_no_fit += row.not_hired_no_fit;
      acc.not_hired_cancelled += row.not_hired_cancelled;
      return acc;
    },
    {
      total: 0,
      hired_here: 0,
      hired_elsewhere: 0,
      not_hired_no_fit: 0,
      not_hired_cancelled: 0,
    },
  );

  // Conversion = hires-through-TheCOE / closed listings (excluding pulled
  // roles, which aren't a fair "did we deliver" signal).
  const fillableClosed = totals.total - totals.not_hired_cancelled;

  return (
    <div>
      <div className="border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Listing outcomes
        </h1>
        <p className="mt-2 text-sm text-muted">
          What happened to closed listings — the marketplace truth-meter. Cancellations
          are excluded from the conversion math.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Closed listings" value={totals.total} />
        <Stat
          label="Hired through TheCOE"
          value={totals.hired_here}
          sub={`${pct(totals.hired_here, fillableClosed)} of fillable closes`}
          accent
        />
        <Stat
          label="Hired off-platform"
          value={totals.hired_elsewhere}
          sub={`${pct(totals.hired_elsewhere, fillableClosed)} of fillable closes`}
        />
        <Stat
          label="Total applications received"
          value={totalApps ?? "—"}
        />
      </div>

      <div className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          By organization
        </h2>
        {rollups.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No outcomes recorded yet. As employers close their listings, this
            view fills in.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-hairline bg-surface">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium text-right">Closed</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Hired here
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Hired elsewhere
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    No hire
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Cancelled
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Conversion
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Last close</th>
                </tr>
              </thead>
              <tbody>
                {rollups.map((r) => {
                  const fillable = r.total_closed - r.not_hired_cancelled;
                  return (
                    <tr
                      key={r.organization_id}
                      className="border-b border-hairline last:border-0"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground">
                          {r.organization_name}
                        </div>
                        <div className="text-xs text-muted">
                          /{r.organization_slug}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {r.total_closed}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {r.hired_here}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {r.hired_elsewhere}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {r.not_hired_no_fit}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {r.not_hired_cancelled}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {pct(r.hired_here, fillable)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted">
                        {r.last_closed_at ? formatDate(r.last_closed_at) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Recent closes
        </h2>
        {outcomes.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No closes yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline border border-hairline bg-surface">
            {outcomes.map((row) => {
              const job = row.jobs;
              const orgName = job?.organizations?.name ?? "—";
              const candidateName = row.hired_application?.profile_snapshot
                ?.full_name
                ? row.hired_application.profile_snapshot.full_name
                : null;
              return (
                <li key={row.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="min-w-[14rem] flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {job?.title ?? "—"}
                      </p>
                      <p className="text-xs text-muted">
                        {orgName}
                        {job?.slug ? ` · /${job.slug}` : ""}
                      </p>
                    </div>
                    <span
                      className={`inline-flex border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${outcomeTone(row.outcome)}`}
                    >
                      {outcomeLabel(row.outcome)}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDate(row.closed_at)}
                    </span>
                  </div>
                  {candidateName ? (
                    <p className="mt-2 text-xs text-muted">
                      Hired:{" "}
                      <span className="text-foreground">{candidateName}</span>
                    </p>
                  ) : null}
                  {row.feedback ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted">
                      &ldquo;{row.feedback}&rdquo;
                    </p>
                  ) : null}
                  {job ? (
                    <p className="mt-2 text-xs">
                      <Link
                        href={`/admin/jobs/${job.id}/edit`}
                        className="text-muted underline underline-offset-2 hover:text-foreground"
                      >
                        Open in admin
                      </Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
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
      {sub ? (
        <p className="mt-1 text-xs text-muted">{sub}</p>
      ) : null}
    </div>
  );
}
