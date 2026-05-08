import type { Metadata } from "next";

import { describeFilters } from "@/lib/alerts/describe-filters";
import { requireAdmin } from "@/lib/auth/admin";
import type { JobDirectoryFilters } from "@/lib/types/jobs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job alerts",
  robots: { index: false, follow: false },
};

type AlertRow = {
  id: string;
  email: string;
  filters: JobDirectoryFilters | null;
  confirmed_at: string | null;
  last_sent_at: string | null;
  created_at: string;
  source: string | null;
};

export default async function AdminAlertsPage() {
  const { supabase } = await requireAdmin();

  const [{ count: totalCount }, { count: confirmedCount }, recent] =
    await Promise.all([
      supabase.from("job_alerts").select("id", { count: "exact", head: true }),
      supabase
        .from("job_alerts")
        .select("id", { count: "exact", head: true })
        .not("confirmed_at", "is", null),
      supabase
        .from("job_alerts")
        .select(
          "id, email, filters, confirmed_at, last_sent_at, created_at, source",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const rows = (recent.data ?? []) as AlertRow[];
  const pending =
    totalCount != null && confirmedCount != null
      ? totalCount - confirmedCount
      : null;

  return (
    <div>
      <div className="border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Job alerts
        </h1>
        <p className="mt-2 text-sm text-muted">
          Double opt-in filter-driven digests. Digest cron:{" "}
          <code className="font-mono text-[11px] text-foreground">
            /api/cron/job-alerts
          </code>{" "}
          (Bearer CRON_SECRET).
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total" value={totalCount ?? "—"} />
        <Stat label="Confirmed" value={confirmedCount ?? "—"} />
        <Stat label="Pending" value={pending ?? "—"} />
      </div>

      <div className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Recent — newest first
        </h2>

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No alerts yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline border border-hairline bg-surface">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex-1 min-w-[14rem] text-sm text-foreground">
                    {row.email}
                  </span>
                  <span
                    className={`text-[10px] font-medium uppercase tracking-[0.14em] ${
                      row.confirmed_at ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {row.confirmed_at ? "Confirmed" : "Pending"}
                  </span>
                  <span className="text-xs text-muted">
                    {formatDate(row.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Criteria: {describeFilters(
                    (row.filters ?? {}) as JobDirectoryFilters,
                  )}
                  {row.last_sent_at ? (
                    <>
                      {" "}
                      · Last sent {formatDate(row.last_sent_at)}
                    </>
                  ) : null}
                  {row.source ? <> · Source {row.source}</> : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-hairline bg-surface px-4 py-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
