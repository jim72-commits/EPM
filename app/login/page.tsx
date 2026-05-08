import Link from "next/link";

import { signInWithPassword } from "@/app/login/actions";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickMessage(
  sp: Record<string, string | string[] | undefined>,
): { tone: "neutral" | "error"; text: string } | null {
  const err = typeof sp.error === "string" ? sp.error : undefined;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;
  const signedOut = sp.signed_out === "1";

  if (reason === "supabase") {
    return {
      tone: "neutral",
      text: "Supabase is not configured. Add environment keys to enable sign-in.",
    };
  }
  if (reason === "password_updated") {
    return {
      tone: "neutral",
      text: "Password updated. Sign in with your new password.",
    };
  }
  if (err === "credentials") {
    return { tone: "error", text: "Invalid email or password." };
  }
  if (err === "invalid") {
    return { tone: "error", text: "Check the email address and try again." };
  }
  if (err === "forbidden") {
    return {
      tone: "error",
      text: "This account is not authorized for admin access.",
    };
  }
  if (err === "no_access") {
    return {
      tone: "error",
      text: "This account isn't linked to any organization yet. Ask the organization owner who invited you to send a fresh invite link.",
    };
  }
  if (err === "oauth") {
    return { tone: "error", text: "Sign-in could not be completed." };
  }
  if (signedOut) {
    return { tone: "neutral", text: "You are signed out." };
  }
  return null;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const message = pickMessage(sp);
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "";
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-20 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        TheCOE
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Sign in
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Candidates, employers, and admins sign in here. New employer?{" "}
        <Link
          href="/signup/employer"
          className="text-foreground underline decoration-hairline underline-offset-4 hover:decoration-foreground"
        >
          Create an account
        </Link>
        .
      </p>

      {message ? (
        <p
          className={`mt-8 border px-4 py-3 text-sm ${
            message.tone === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-hairline bg-surface text-muted"
          }`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      {!configured ? (
        <p className="mt-10 text-sm text-muted">
          Set{" "}
          <code className="font-mono text-xs text-foreground">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="font-mono text-xs text-foreground">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          in{" "}
          <code className="font-mono text-xs text-foreground">.env.local</code>,
          then create a user and an{" "}
          <code className="font-mono text-xs text-foreground">
            admin_profiles
          </code>{" "}
          row per the README.
        </p>
      ) : (
        <form action={signInWithPassword} className="mt-10 space-y-6">
          {next ? <input type="hidden" name="next" value={next} /> : null}
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
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted underline decoration-hairline underline-offset-4 hover:text-foreground hover:decoration-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center border border-transparent bg-accent text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
          >
            Sign in
          </button>
        </form>
      )}

      <p className="mt-10 text-xs uppercase tracking-[0.1em] text-muted">
        <Link href="/" className="hover:text-foreground">
          Back to home
        </Link>
      </p>
    </main>
  );
}
