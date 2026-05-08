import type { Metadata } from "next";
import Link from "next/link";

import { subscribeToAlerts } from "@/app/alerts/actions";
import { describeFilters } from "@/lib/alerts/describe-filters";
import { parseJobSearchParams } from "@/lib/jobs-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Job alerts",
  description:
    "Get new Anaplan roles in your inbox. Weekly digest, one-click unsubscribe.",
};

const ERROR_COPY: Record<string, string> = {
  invalid_email: "Please enter a valid email address.",
  service_unavailable:
    "Alerts aren't wired up yet. Check back after the next deploy.",
  server_error: "Something went wrong saving your alert. Try again.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JobAlertsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseJobSearchParams(params);
  const description = describeFilters(filters);
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? ERROR_COPY[errorKey] : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Job alerts
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        New Anaplan roles in your inbox.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
        A weekly digest of open Anaplan roles matching your filters. Double
        opt-in, one-click unsubscribe.
      </p>

      <div className="mt-10 border border-hairline bg-surface p-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Criteria
        </p>
        <p className="mt-2 text-base text-foreground">{description}</p>
        <p className="mt-3 text-xs text-muted">
          Not what you want?{" "}
          <Link href="/jobs" className="text-accent underline">
            Adjust filters on /jobs
          </Link>
          , then click &ldquo;Get alerts&rdquo; from there to pre-fill this
          page.
        </p>
      </div>

      <form
        action={subscribeToAlerts}
        className="mt-10 flex flex-wrap items-end gap-3 border-t border-hairline pt-10"
      >
        <div className="flex-1 min-w-[16rem]">
          <label
            htmlFor="alert-email"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Email
          </label>
          <input
            id="alert-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>
        {filters.platform ? (
          <input type="hidden" name="platform" value={filters.platform} />
        ) : null}
        {filters.role ? (
          <input type="hidden" name="role" value={filters.role} />
        ) : null}
        {filters.remote ? (
          <input type="hidden" name="remote" value={filters.remote} />
        ) : null}
        {filters.country ? (
          <input type="hidden" name="country" value={filters.country} />
        ) : null}
        {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
        <input type="hidden" name="source" value="alerts_page" />
        <button
          type="submit"
          className="inline-flex h-[2.375rem] items-center justify-center border border-transparent bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          Create alert
        </button>
      </form>

      {errorMessage ? (
        <p className="mt-4 text-sm text-[color:var(--color-error,#b00020)]">
          {errorMessage}
        </p>
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        We use double opt-in. A confirmation email is required before any
        digest is sent. Unsubscribe from any edition with one click.
      </p>
    </main>
  );
}
