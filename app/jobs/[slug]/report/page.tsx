import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getOptionalAuth } from "@/lib/auth/admin";
import { getJobBySlug } from "@/lib/jobs-queries";

import { reportListing } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Report a listing · TheCOE",
    robots: { index: false, follow: false },
  };
}

const REASON_OPTIONS = [
  { value: "spam", label: "Spam or duplicate" },
  { value: "scam", label: "Looks like a scam" },
  { value: "misleading", label: "Misleading title or description" },
  { value: "off_topic", label: "Not actually an Anaplan role" },
  { value: "harassment", label: "Harassment or discrimination" },
  { value: "other", label: "Something else" },
] as const;

export default async function ReportListingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const errorMsg = typeof sp.error === "string" ? sp.error : null;
  const duplicate = sp.duplicate === "1";

  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const auth = await getOptionalAuth();
  const reportListingBound = reportListing.bind(null, slug);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8">
      <Link
        href={`/jobs/${slug}`}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        Back to listing
      </Link>

      <header className="mt-8 border-b border-hairline pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Trust & safety
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Report this listing
        </h1>
        <p className="mt-3 text-sm text-muted">
          Reporting <strong className="text-foreground">{job.title}</strong> at{" "}
          <strong className="text-foreground">{job.organization.name}</strong>.
          An admin will review and decide. We won&apos;t auto-remove the listing
          based on a single report.
        </p>
      </header>

      {duplicate ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          You&apos;ve already filed an open report on this listing. We&apos;ll get
          back to you on that one before another can be opened.
        </p>
      ) : null}

      {errorMsg ? (
        <p className="mt-6 border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          {errorMsg}
        </p>
      ) : null}

      <form action={reportListingBound} className="mt-8 space-y-8">
        <fieldset className="space-y-4">
          <legend className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Reason
          </legend>
          <div className="space-y-2">
            {REASON_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 border border-hairline px-4 py-3 hover:border-foreground"
              >
                <input
                  type="radio"
                  name="reason"
                  value={opt.value}
                  required
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            What&apos;s the issue?
          </span>
          <textarea
            name="details"
            required
            minLength={10}
            maxLength={4000}
            rows={6}
            placeholder="Tell us what's wrong. The more specific, the faster we can act."
            className="mt-2 block w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
          />
          <span className="mt-1 block text-xs text-muted">
            10–4000 characters.
          </span>
        </label>

        {!auth.user ? (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Your email (optional)
            </span>
            <input
              type="email"
              name="reporter_email"
              maxLength={320}
              placeholder="you@example.com"
              className="mt-2 block w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
            />
            <span className="mt-1 block text-xs text-muted">
              Only used so we can ask follow-up questions if needed. We never
              share it with the employer.
            </span>
          </label>
        ) : (
          <p className="text-xs text-muted">
            Filing this report as <strong>{auth.user.email}</strong>. We won&apos;t
            share your identity with the employer.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-8">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center border border-transparent bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-accent hover:text-on-accent"
          >
            Submit report
          </button>
          <Link
            href={`/jobs/${slug}`}
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
