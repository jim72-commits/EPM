import Image from "next/image";
import Link from "next/link";

import {
  formatCountry,
  formatEmploymentType,
  formatPublishedDate,
  formatRemotePolicy,
} from "@/lib/format-job";
import { getOrgLogoUrl } from "@/lib/org-logo-url";
import type { JobListItem } from "@/lib/types/jobs";

type JobListProps = {
  jobs: JobListItem[];
  hasFilters?: boolean;
};

const NEW_THIS_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isNewThisWeek(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_THIS_WEEK_MS;
}

export function JobList({ jobs, hasFilters = false }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="mt-12 border border-hairline bg-surface p-10">
        <p className="text-sm font-medium text-foreground">No matching roles.</p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          {hasFilters
            ? "Try clearing filters, or set up an alert and we'll email you when a match goes live."
            : "Check back as new listings go live, or set up an alert and we'll email you when one matches."}
        </p>
        {hasFilters ? (
          <p className="mt-4">
            <Link
              href="/jobs"
              className="text-xs font-medium uppercase tracking-[0.12em] text-foreground underline-offset-4 hover:underline"
            >
              Clear filters
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-12">
      <div className="hidden border-b border-hairline pb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted md:grid md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-4">
        <span aria-hidden />
        <span>Role</span>
        <span>Organization</span>
        <span>Platform</span>
        <span>Location</span>
        <span className="text-right">Listing</span>
      </div>
      <ul className="divide-y divide-hairline border border-hairline bg-surface">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobRow job={job} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobRow({ job }: { job: JobListItem }) {
  const kindLabel =
    job.listing_kind === "employer"
      ? "On TheCOE"
      : "Apply on employer site";
  const logoUrl = getOrgLogoUrl(job.organization.logo_storage_path);
  const fresh = isNewThisWeek(job.published_at);

  // Card-link pattern: the whole row is clickable via an absolute-positioned
  // overlay anchor (z-0). Nested anchors (org name, etc.) live above on
  // z-10 with `relative` so they intercept clicks first. This keeps both
  // big-target affordance and the ability to click through to the org page
  // without nesting <a> inside <a>.
  return (
    <article
      className={
        job.is_featured
          ? "relative block px-4 py-5 transition-colors duration-150 hover:bg-page md:px-5 border-l-2 border-l-accent bg-accent/5"
          : "relative block px-4 py-5 transition-colors duration-150 hover:bg-page md:px-5"
      }
    >
      <Link
        href={`/jobs/${job.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`${job.title} at ${job.organization.name}`}
      >
        <span className="sr-only">View role</span>
      </Link>

      <div className="relative z-10 md:grid md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-baseline md:gap-4">
        <div className="hidden md:flex md:h-10 md:w-10 md:items-center md:justify-center md:overflow-hidden md:border md:border-hairline md:bg-background">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              unoptimized
            />
          ) : (
            <span className="text-[10px] font-semibold tracking-tight text-muted">
              {job.organization.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted md:hidden">
            Role
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 md:mt-0">
            <p className="text-base font-semibold text-foreground">
              {job.title}
            </p>
            {job.is_featured ? (
              <span className="inline-flex items-center border border-accent bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                Featured
              </span>
            ) : null}
            {fresh && !job.is_featured ? (
              <span className="inline-flex items-center border border-foreground/30 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground">
                New this week
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {formatRemotePolicy(job.remote_policy)} ·{" "}
            {formatEmploymentType(job.employment_type)} ·{" "}
            {formatCountry(job.country_code)}
          </p>
          <p className="mt-2 text-xs text-muted md:hidden">
            {formatPublishedDate(job.published_at)}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3 md:mt-0">
          <div className="md:hidden flex h-8 w-8 items-center justify-center overflow-hidden border border-hairline bg-background">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                unoptimized
              />
            ) : (
              <span className="text-[9px] font-semibold tracking-tight text-muted">
                {job.organization.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted md:hidden">
              Organization
            </p>
            <Link
              href={`/employers/${job.organization.slug}`}
              className="mt-1 inline-block text-sm text-foreground hover:underline md:mt-0"
            >
              {job.organization.name}
            </Link>
          </div>
        </div>
        <div className="mt-3 md:mt-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted md:hidden">
            Platform
          </p>
          <p className="mt-1 text-sm text-foreground md:mt-0">
            {job.platform.name}
          </p>
        </div>
        <div className="mt-3 md:mt-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted md:hidden">
            Location
          </p>
          <p className="mt-1 text-sm text-foreground md:mt-0">
            {job.location_label ?? "—"}
          </p>
          <p className="mt-1 hidden text-xs text-muted md:block">
            {formatPublishedDate(job.published_at)}
          </p>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4 md:mt-0 md:justify-end">
          <span className="inline-flex border border-hairline px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            {kindLabel}
          </span>
        </div>
      </div>
    </article>
  );
}
