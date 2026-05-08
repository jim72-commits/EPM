import type { Metadata } from "next";
import Link from "next/link";

import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm subscription",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ConfirmState =
  | { kind: "ok"; email: string }
  | { kind: "already" }
  | { kind: "invalid" }
  | { kind: "unavailable" };

async function confirmToken(token: string): Promise<ConfirmState> {
  if (!isServiceRoleAvailable()) {
    return { kind: "unavailable" };
  }

  const svc = createServiceRoleSupabaseClient();

  const { data: row, error: selErr } = await svc
    .from("newsletter_subscribers")
    .select("id, email, confirmed_at")
    .eq("confirm_token", token)
    .maybeSingle();

  if (selErr) {
    console.error("[newsletter:confirm] select error", selErr);
    return { kind: "invalid" };
  }

  if (!row) return { kind: "invalid" };
  if (row.confirmed_at) return { kind: "already" };

  const { error: updErr } = await svc
    .from("newsletter_subscribers")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (updErr) {
    console.error("[newsletter:confirm] update error", updErr);
    return { kind: "invalid" };
  }

  return { kind: "ok", email: row.email };
}

export default async function NewsletterConfirmPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";

  const state: ConfirmState = token
    ? await confirmToken(token)
    : { kind: "invalid" };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Newsletter
      </p>
      {state.kind === "ok" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            You&apos;re subscribed.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            Thanks — <span className="text-foreground">{state.email}</span> is
            confirmed. Expect the next edition within a month.
          </p>
        </>
      ) : null}
      {state.kind === "already" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Already subscribed.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            This email is already active on the TheCOE newsletter.
          </p>
        </>
      ) : null}
      {state.kind === "invalid" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Confirmation link invalid.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            This link may have expired or was already replaced by a newer
            confirmation.{" "}
            <Link href="/newsletter" className="text-accent underline">
              Request a new link
            </Link>
            .
          </p>
        </>
      ) : null}
      {state.kind === "unavailable" ? (
        <>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Newsletter not yet live.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            Subscriptions aren&apos;t fully wired up yet. Check back after the
            next deploy.
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
