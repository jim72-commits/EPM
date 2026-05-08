import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Anaplan only · North America
      </p>
      <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl sm:leading-tight">
        The inner circle of Anaplan.
      </h1>
      <p className="mt-8 max-w-2xl text-base leading-relaxed text-muted">
        Not another job board. TheCOE is a dedicated pairing site between
        companies that run Anaplan and the professionals who build, model,
        and administer the platform. Every posting comes from an
        Anaplan-using company; every applicant has hands-on Anaplan
        experience.
      </p>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <Link
          href="/jobs"
          className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          Browse open roles
        </Link>
        <Link
          href="/post"
          className="inline-flex h-11 items-center justify-center border border-hairline bg-surface px-6 text-sm font-medium text-foreground transition-colors duration-150 hover:border-foreground"
        >
          Post a job
        </Link>
      </div>

      <div className="mt-20 grid gap-10 border-t border-hairline pt-12 sm:grid-cols-2 sm:gap-12">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            For candidates
          </p>
          <p className="mt-3 text-base leading-relaxed text-foreground">
            Every role on this site is at a company that runs on Anaplan.
            No generalist FP&amp;A noise to sift through — modelers,
            solution architects, business analysts, and platform admins in
            one place.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium uppercase tracking-[0.12em]">
            <Link
              href="/jobs"
              className="text-accent hover:text-accent-hover"
            >
              Browse roles →
            </Link>
            <Link
              href="/alerts"
              className="text-muted hover:text-foreground"
            >
              Set up a job alert →
            </Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            For hiring teams
          </p>
          <p className="mt-3 text-base leading-relaxed text-foreground">
            Post a role in minutes. Every applicant already knows Anaplan
            — no sifting through unrelated resumes. Listings go live as
            soon as payment clears.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium uppercase tracking-[0.12em]">
            <Link
              href="/post"
              className="text-accent hover:text-accent-hover"
            >
              Post a job →
            </Link>
            <Link
              href="/signup"
              className="text-muted hover:text-foreground"
            >
              Create an employer account →
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-16 max-w-xl text-xs leading-relaxed text-muted">
        Monthly newsletter: Anaplan hiring trends, compensation benchmarks,
        and notable new roles.{" "}
        <Link href="/newsletter" className="text-accent underline">
          Subscribe →
        </Link>
      </p>
    </main>
  );
}
