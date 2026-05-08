import Link from "next/link";
import { redirect } from "next/navigation";

import { getOptionalAuth } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

import { signUpWithOrg } from "./actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const inputClass =
  "mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

export default async function EmployerSignupPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const reason = typeof sp.reason === "string" ? sp.reason : undefined;

  const preserved = {
    email: typeof sp.email === "string" ? sp.email : "",
    company_name: typeof sp.company_name === "string" ? sp.company_name : "",
    country_code:
      sp.country_code === "CA" || sp.country_code === "US" ? sp.country_code : "US",
    organization_type:
      sp.organization_type === "agency" || sp.organization_type === "direct"
        ? sp.organization_type
        : "direct",
  };

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-20 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Hiring on TheCOE
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
    const firstOrg = auth.memberships[0]?.organization.slug;
    if (firstOrg) {
      redirect(`/employer/${firstOrg}/jobs/new`);
    }
    if (auth.isAdmin) redirect("/admin/jobs");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-20 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Hiring on TheCOE
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Create your employer account
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        One form for your account and your company. You&apos;ll describe the
        role on the next page.
      </p>

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

      <form action={signUpWithOrg} className="mt-10 space-y-8">
        <section className="space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Account
          </p>
          <div>
            <label htmlFor="email" className={labelClass}>
              Work email
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
            Company
          </p>
          <div>
            <label htmlFor="company_name" className={labelClass}>
              Company name
            </label>
            <input
              id="company_name"
              name="company_name"
              required
              maxLength={200}
              defaultValue={preserved.company_name}
              className={inputClass}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
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
            </div>
            <div>
              <label htmlFor="organization_type" className={labelClass}>
                You are
              </label>
              <select
                id="organization_type"
                name="organization_type"
                defaultValue={preserved.organization_type}
                className={inputClass}
              >
                <option value="direct">A direct employer</option>
                <option value="agency">A recruiting agency</option>
              </select>
            </div>
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
        <Link href="/login?next=/post" className="hover:text-foreground">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-xs uppercase tracking-[0.1em] text-muted">
        Not hiring?{" "}
        <Link href="/signup/candidate" className="hover:text-foreground">
          Create a candidate account
        </Link>
      </p>
    </main>
  );
}
