import Link from "next/link";

import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

import { requestPasswordReset } from "./actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const expired = sp.error === "expired";
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-20 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        TheCOE
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Reset password
      </h1>

      {sent ? (
        <div className="mt-8 border border-hairline bg-surface px-4 py-4 text-sm text-muted">
          <p className="text-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
          <p className="mt-2">
            Check your inbox (and spam) — the link expires in 1 hour. Didn&apos;t
            get one?{" "}
            <Link
              href="/forgot-password"
              className="text-foreground underline decoration-hairline underline-offset-4 hover:decoration-foreground"
            >
              Try again
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Enter the email on your account and we&apos;ll send a one-time link
            to set a new password.
          </p>

          {expired ? (
            <p
              className="mt-8 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="status"
            >
              That reset link has expired or was already used. Request a new
              one below.
            </p>
          ) : null}

          {!configured ? (
            <p className="mt-10 text-sm text-muted">
              Supabase is not configured. Add environment keys to enable
              password reset.
            </p>
          ) : (
            <form action={requestPasswordReset} className="mt-10 space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center border border-transparent bg-accent text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
              >
                Send reset link
              </button>
            </form>
          )}
        </>
      )}

      <p className="mt-10 text-xs uppercase tracking-[0.1em] text-muted">
        <Link href="/login" className="hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
