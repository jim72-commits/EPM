import Link from "next/link";

import { getOptionalAuth } from "@/lib/auth/admin";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function PostLandingPage() {
  const auth = await getOptionalAuth();
  const signedIn = Boolean(auth.user);
  const firstOrg = auth.memberships[0]?.organization.slug;

  const ctaHref = !signedIn
    ? "/signup/employer"
    : firstOrg
      ? `/employer/${firstOrg}/jobs/new`
      : "/signup/employer";

  return (
    <main className="mx-auto max-w-5xl flex-1 px-6 py-20 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Post a job
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Hire Anaplan talent across North America
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted">
          TheCOE is the inner circle of Anaplan — a dedicated pairing site
          for hiring teams in the United States and Canada. Every applicant
          arrives with verified Anaplan experience, so you spend your time
          reviewing fits, not filtering noise.
        </p>
        <div className="mt-6 inline-flex items-center gap-3 border border-accent bg-accent/5 px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            Free posting
          </span>
          <span className="text-xs text-foreground">
            All listings are free, indefinitely.
          </span>
        </div>
      </div>

      <section className="mt-16 grid gap-10 border-t border-hairline pt-10 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            1 · Create your account
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            A minute of setup: company name, country, employer or agency.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            2 · Describe the role
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            Platform, role family, country, remote policy, and a full
            description in Markdown.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            3 · Submit for review
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            We review submissions within one business day to keep the board
            high-signal. Approved listings go live immediately.
          </p>
        </div>
      </section>

      <section className="mt-16 border-t border-hairline pt-10">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          What we approve
        </p>
        <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
          <li>
            Anaplan or adjacent EPM roles &mdash; modeler, architect, admin,
            consultant, manager, lead.
          </li>
          <li>
            Roles with clear, specific responsibilities. We&apos;ll politely
            ask you to expand vague descriptions.
          </li>
          <li>
            Salary range encouraged but not required. Remote / hybrid /
            on-site clearly stated.
          </li>
          <li>
            Recruiter-posted roles fine, as long as the hiring company is
            named or clearly representable.
          </li>
        </ul>
      </section>

      <div className="mt-16 flex flex-wrap items-center gap-6 border-t border-hairline pt-10">
        <Link
          href={ctaHref}
          className="inline-flex h-12 items-center justify-center border border-transparent bg-accent px-8 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          {signedIn ? "Continue" : "Get started"}
        </Link>
        {!signedIn ? (
          <Link
            href="/login?next=/post"
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
          >
            Already have an account? Sign in
          </Link>
        ) : null}
      </div>

      <p className="mt-16 text-xs leading-relaxed text-muted">
        Questions? Email{" "}
        <a
          href={SUPPORT_MAILTO}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </main>
  );
}
