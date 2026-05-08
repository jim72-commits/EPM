import type { Metadata } from "next";
import Link from "next/link";

import { describeFilters } from "@/lib/alerts/describe-filters";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";
import type { JobDirectoryFilters } from "@/lib/types/jobs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm alert",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ConfirmState =
  | { kind: "ok"; email: string; description: string }
  | { kind: "already"; description: string }
  | { kind: "invalid" }
  | { kind: "unavailable" };

async function confirmToken(token: string): Promise<ConfirmState> {
  if (!isServiceRoleAvailable()) return { kind: "unavailable" };

  const svc = createServiceRoleSupabaseClient();

  const { data: row, error: selErr } = await svc
    .from("job_alerts")
    .select("id, email, confirmed_at, filters")
    .eq("confirm_token", token)
    .maybeSingle();

  if (selErr) {
    console.error("[alerts:confirm] select error", selErr);
    return { kind: "invalid" };
  }
  if (!row) return { kind: "invalid" };

  const description = describeFilters(
    (row.filters ?? {}) as JobDirectoryFilters,
  );

  if (row.confirmed_at) return { kind: "already", description };

  const { error: updErr } = await svc
    .from("job_alerts")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (updErr) {
    console.error("[alerts:confirm] update error", updErr);
    return { kind: "invalid" };
  }

  return { kind: "ok", email: row.email, description };
}

export default async function AlertConfirmPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";

  const state: ConfirmState = token
    ? await confirmToken(token)
    : { kind: "invalid" };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Job alerts
      </p>
      {state.kind === "ok" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Alert active.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            <span className="text-foreground">{state.email}</span> will receive
            a weekly digest of new Anaplan roles matching{" "}
            <span className="text-foreground">{state.description}</span>. First
            email arrives when there are new matches.
          </p>
        </>
      ) : null}
      {state.kind === "already" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Already confirmed.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            This alert is already active for{" "}
            <span className="text-foreground">{state.description}</span>.
          </p>
        </>
      ) : null}
      {state.kind === "invalid" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Confirmation link invalid.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            This link may have expired or was replaced by a newer
            confirmation.{" "}
            <Link href="/alerts" className="text-accent underline">
              Create a new alert
            </Link>
            .
          </p>
        </>
      ) : null}
      {state.kind === "unavailable" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Alerts not yet live.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            Alerts aren&apos;t fully wired up yet. Check back after the next
            deploy.
          </p>
        </>
      ) : null}
      <Link
        href="/jobs"
        className="mt-12 text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
      >
        Browse Anaplan jobs →
      </Link>
    </main>
  );
}
