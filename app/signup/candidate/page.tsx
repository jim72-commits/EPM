import Link from "next/link";
import { redirect } from "next/navigation";

import { getOptionalAuth } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

import { signUpAsCandidate } from "./actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const inputClass =
  "mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

export default async function CandidateSignupPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;

  const preserved = {
    email: typeof sp.email === "string" ? sp.email : "",
    full_name: typeof sp.full_name === "string" ? sp.full_name : "",
    country_code:
      sp.country_code === "CA" || sp.country_code === "US" ? sp.country_code : "US",
  };

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-20 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Candidate signup
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Signup is not available yet
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Configure Supabase environment variables to enable account creation.
        </p>
        <p className="mt-10 text-xs uppercase tracking-[0.1em] text-muted">
          <Link href="/" className="hover:text-foreground">
            Back to home
          </Link>
        </p>
      </main>
    );
  }

  const auth = await getOptionalAuth();
  if (auth.user) {
    if (auth.hasCandidateProfile) {
      redirect("/me/profile");
    }
    // Already signed in as an employer/admin but no candidate profile yet —
    // fall through to the form so they can add the candidate role.
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-20 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Candidate account
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Create your candidate profile
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Get discovered by companies hiring for Anaplan roles in North America.
        You&apos;ll flesh out your resume, credentials, and work preferences on
        the next page.
      </p>

      {reason === "complete_profile" ? (
        <p className="mt-8 border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          Create a candidate account to continue.
        </p>
      ) : null}
      {reason === "supabase" ? (
        <p className="mt-8 border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          Supabase is not configured. Add environment keys to enable sign-up.
        </p>
      ) : null}
      {error ? (
        <p className="mt-8 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <form action={signUpAsCandidate} className="mt-10 space-y-8">
        <section className="space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Account
          </p>
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={preserved.email}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password (min 8)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClass}
            />
          </div>
        </section>

        <section className="space-y-6 border-t border-hairline pt-8">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            About you
          </p>
          <div>
            <label htmlFor="full_name" className={labelClass}>
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              required
              maxLength={200}
              autoComplete="name"
              defaultValue={preserved.full_name}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="country_code" className={labelClass}>
              Country
            </label>
            <select
              id="country_code"
              name="country_code"
              defaultValue={preserved.country_code}
              className={inputClass}
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </select>
            <p className="mt-2 text-xs text-muted">
              You can be open to roles in both countries — we&apos;ll ask about
              work authorization on the next page.
            </p>
          </div>
        </section>

        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center border border-transparent bg-accent text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          Create account and continue
        </button>
      </form>

      <p className="mt-10 text-xs leading-relaxed text-muted">
        By signing up, you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="mt-4 text-xs uppercase tracking-[0.1em] text-muted">
        Already have an account?{" "}
        <Link href="/login?next=/me/profile" className="hover:text-foreground">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-xs uppercase tracking-[0.1em] text-muted">
        Hiring instead?{" "}
        <Link href="/signup/employer" className="hover:text-foreground">
          Create an employer account
        </Link>
      </p>
    </main>
  );
}
