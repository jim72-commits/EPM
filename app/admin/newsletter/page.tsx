import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Newsletter",
  robots: { index: false, follow: false },
};

type SubscriberRow = {
  id: string;
  email: string;
  source: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export default async function AdminNewsletterPage() {
  const { supabase } = await requireAdmin();

  const [{ count: totalCount }, { count: confirmedCount }, recent] =
    await Promise.all([
      supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .not("confirmed_at", "is", null),
      supabase
        .from("newsletter_subscribers")
        .select("id, email, source, confirmed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const rows = (recent.data ?? []) as SubscriberRow[];
  const pending =
    totalCount != null && confirmedCount != null
      ? totalCount - confirmedCount
      : null;

  return (
    <div>
      <div className="border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Newsletter
        </h1>
        <p className="mt-2 text-sm text-muted">
          Double opt-in subscribers. Service-role writes only — this view is
          read-only for now.
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
          <p className="mt-4 text-sm text-muted">
            No subscribers yet. Add a newsletter sign-up CTA in your next post
            or on social to seed the list.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline border border-hairline bg-surface">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <span className="flex-1 min-w-[14rem] text-sm text-foreground">
                  {row.email}
                </span>
                <span className="text-xs text-muted">
                  {row.source ?? "—"}
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
