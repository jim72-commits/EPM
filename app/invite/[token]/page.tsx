import { redirect } from "next/navigation";

import { getOptionalAuth } from "@/lib/auth/admin";
import { signOut } from "@/app/login/actions";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

import { acceptInvite } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export default async function AcceptInvitePage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const sp = await searchParams;
  const error =
    typeof sp.error === "string" ? sp.error : null;
  const expectedEmailRaw = typeof sp.for === "string" ? sp.for : null;
  const expectedEmail = expectedEmailRaw
    ? normalizeEmail(expectedEmailRaw)
    : null;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Sign-in unavailable
        </h1>
        <p className="mt-4 text-sm text-muted">
          Auth isn&apos;t configured in this environment. Try again from the
          live site.
        </p>
      </main>
    );
  }

  // Bounce unauthenticated visitors to /login with a return path that
  // includes this token (and the original `for` hint). After login they'll
  // land back here, and we'll pass straight through to the accept action.
  const auth = await getOptionalAuth();
  if (!auth.user) {
    const next = expectedEmailRaw
      ? `/invite/${token}?for=${encodeURIComponent(expectedEmailRaw)}`
      : `/invite/${token}`;
    redirect(`/login?next=${encodeURIComponent(next)}&reason=invite`);
  }

  const signedInEmail = auth.user.email
    ? normalizeEmail(auth.user.email)
    : null;
  // Best-effort heads-up only. The RPC still trusts the bearer of a valid
  // token because (a) the token already gates everything else and (b)
  // forwarding an invite to a teammate's secondary email is a real flow
  // we don't want to block. Hard-bind to email later if we ever see abuse.
  const emailMismatch = Boolean(
    expectedEmail && signedInEmail && signedInEmail !== expectedEmail,
  );

  const submit = acceptInvite.bind(null, token);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        Team invite
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        Accept invite
      </h1>
      <p className="mt-4 text-sm text-muted">
        Signed in as{" "}
        <span className="text-foreground">{auth.user.email}</span>. Confirm
        below to join the team. The invite link is one-time use; if you got
        this in error, just close the tab.
      </p>

      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {emailMismatch && expectedEmail ? (
        <div className="mt-6 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            This invite was sent to <code className="font-mono">{expectedEmail}</code>.
          </p>
          <p className="mt-1 text-amber-800">
            You&apos;re signed in as <strong>{auth.user.email}</strong>. If you
            meant to use a different account, sign out below and sign back in
            as the invited address before accepting.
          </p>
        </div>
      ) : null}

      <form action={submit} className="mt-8">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Accept invite
        </button>
      </form>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
        >
          Wrong account? Sign out
        </button>
      </form>
    </main>
  );
}
