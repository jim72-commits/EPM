import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { getOptionalAuth } from "@/lib/auth/admin";
import {
  formatCountry,
  formatEmploymentType,
  formatPublishedDate,
  formatRemotePolicy,
} from "@/lib/format-job";
import { getAppBaseUrl } from "@/lib/app-url";
import { buildJobPostingJsonLd } from "@/lib/job-posting-jsonld";
import { getJobBySlug } from "@/lib/jobs-queries";
import { getOrgLogoUrl } from "@/lib/org-logo-url";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const NEW_THIS_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isNewThisWeek(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_THIS_WEEK_MS;
}

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) {
    return { title: "Job not found" };
  }
  const canonical = `${getAppBaseUrl()}/jobs/${job.slug}`;
  const description = buildJobMetaDescription(job);
  return {
    title: job.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${job.title} · TheCOE`,
      description,
      url: canonical,
      type: "website",
    },
  };
}

/**
 * Build a 1-2 sentence meta description that's actually informative for SERPs.
 * Falls back gracefully when fields are missing.
 */
function buildJobMetaDescription(job: {
  title: string;
  organization: { name: string };
  platform: { name: string };
  country_code: "US" | "CA";
  remote_policy: string;
  location_label: string | null;
  summary: string | null;
  full_description: string | null;
}): string {
  const where = job.location_label
    ? `${job.location_label}, ${formatCountry(job.country_code)}`
    : formatCountry(job.country_code);
  const lead = `${job.title} at ${job.organization.name} — ${job.platform.name}, ${formatRemotePolicy(job.remote_policy as "remote" | "hybrid" | "onsite" | "flexible")}, ${where}.`;
  const body = job.summary?.trim() || extractFirstSentence(job.full_description ?? "");
  if (!body) return lead;
  const combined = `${lead} ${body}`;
  if (combined.length <= 280) return combined;
  return `${combined.slice(0, 277)}…`;
}

function extractFirstSentence(markdown: string): string {
  const stripped = markdown
    .replace(/^#+\s.*$/gm, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  if (!stripped) return "";
  const match = stripped.match(/^(.{20,200}?[.!?])\s/);
  if (match) return match[1];
  return stripped.slice(0, 160);
}

export default async function JobDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const reported = sp.reported === "1";
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const syndicated = job.listing_kind === "syndicated";
  const jsonLd = buildJobPostingJsonLd({ job, baseUrl: getAppBaseUrl() });

  // For paid listings we render an in-product apply CTA. Look up the
  // viewer's state so we can preselect "Apply", "Already applied", or
  // "Create a candidate account" without a client-side round trip.
  let existingApplicationId: string | null = null;
  let viewerState: "anonymous" | "candidate" | "other_role" = "anonymous";

  if (!syndicated && isSupabaseConfigured()) {
    const auth = await getOptionalAuth();
    if (auth.user) {
      viewerState = auth.hasCandidateProfile ? "candidate" : "other_role";
      if (auth.hasCandidateProfile) {
        const supabase = await createServerSupabaseClient();
        const { data: existing } = await supabase
          .from("job_applications")
          .select("id")
          .eq("job_id", job.id)
          .eq("candidate_user_id", auth.user.id)
          .maybeSingle();
        existingApplicationId = existing?.id ?? null;
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16 lg:px-8">
      {jsonLd ? (
        <script
          type="application/ld+json"
          // Rendered server-side, safe string-ified JSON — no user-controlled HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}

      {!isSupabaseConfigured() ? (
        <p className="mb-10 border border-hairline bg-surface px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted">
          Development mode: sample listing.
        </p>
      ) : null}

      {reported ? (
        <p className="mb-8 border border-foreground/20 bg-surface px-4 py-3 text-sm text-foreground">
          Thanks — your report is in the queue. An admin will take a look. We
          won&apos;t auto-remove the listing based on a single report.
        </p>
      ) : null}

      <Link
        href="/jobs"
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        All jobs
      </Link>

      <header className="mt-8 border-b border-hairline pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-hairline px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            {syndicated ? "Apply on employer site" : "On TheCOE"}
          </span>
          {job.is_featured ? (
            <span className="border border-accent bg-accent/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
              Featured
            </span>
          ) : null}
          {isNewThisWeek(job.published_at) && !job.is_featured ? (
            <span className="border border-foreground/30 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground">
              New this week
            </span>
          ) : null}
          <span className="text-xs text-muted">{job.platform.name}</span>
        </div>
        <div className="mt-4 flex items-start gap-4">
          <OrgLogo
            path={job.organization.logo_storage_path}
            name={job.organization.name}
          />
          <div className="flex-1">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {job.title}
            </h1>
            <p className="mt-2 text-sm text-muted">
              <Link
                href={`/employers/${job.organization.slug}`}
                className="hover:text-foreground hover:underline"
              >
                {job.organization.name}
              </Link>
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          {formatRemotePolicy(job.remote_policy)} ·{" "}
          {formatEmploymentType(job.employment_type)}
          <span className="mx-2 text-muted">|</span>
          {formatCountry(job.country_code)}
        </p>
        <p className="mt-2 text-sm text-muted">
          {job.location_label ?? "Location on request"}
          <span className="mx-2 text-muted">|</span>
          Posted {formatPublishedDate(job.published_at)}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.1em] text-muted">
          Role family: {job.role_family.name}
        </p>
      </header>

      {syndicated ? (
        <div className="mt-10 space-y-8">
          <section>
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Summary
            </h2>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              {job.summary}
            </p>
            <p className="mt-6 text-sm leading-relaxed text-muted">
              The full job description lives on the employer or partner site —
              the apply button leaves to that listing. We don&apos;t track
              outcomes on syndicated roles.
            </p>
          </section>
          {job.external_apply_url ? (
            <a
              href={job.external_apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
            >
              Continue to apply
            </a>
          ) : null}
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          <section className="prose prose-neutral max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:text-base prose-p:leading-relaxed prose-li:marker:text-muted">
            <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted not-prose">
              Description
            </h2>
            <div className="mt-4">
              <ReactMarkdown>{job.full_description ?? ""}</ReactMarkdown>
            </div>
          </section>
          <ApplyCta
            slug={job.slug}
            viewerState={viewerState}
            existingApplicationId={existingApplicationId}
          />
        </div>
      )}

      <footer className="mt-16 border-t border-hairline pt-6">
        <Link
          href={`/jobs/${job.slug}/report`}
          className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
        >
          Report this listing
        </Link>
      </footer>
    </main>
  );
}

function OrgLogo({ path, name }: { path: string | null; name: string }) {
  const url = getOrgLogoUrl(path);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-hairline bg-surface">
      {url ? (
        <Image
          src={url}
          alt={`${name} logo`}
          width={56}
          height={56}
          className="h-14 w-14 object-contain"
          unoptimized
        />
      ) : (
        <span className="text-sm font-semibold tracking-tight text-muted">
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function ApplyCta({
  slug,
  viewerState,
  existingApplicationId,
}: {
  slug: string;
  viewerState: "anonymous" | "candidate" | "other_role";
  existingApplicationId: string | null;
}) {
  if (existingApplicationId) {
    return (
      <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-8">
        <Link
          href={`/me/applications/${existingApplicationId}`}
          className="inline-flex h-11 items-center justify-center border border-foreground bg-foreground px-6 text-sm font-medium text-background transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
        >
          View your application
        </Link>
        <p className="text-sm text-muted">You&apos;ve already applied to this role.</p>
      </div>
    );
  }

  const applyHref = `/jobs/${slug}/apply`;

  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-8">
      <Link
        href={applyHref}
        className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        Apply on TheCOE
      </Link>
      {viewerState === "anonymous" ? (
        <p className="text-xs text-muted">
          You&apos;ll sign in or create a candidate account on the next page.
        </p>
      ) : null}
      {viewerState === "other_role" ? (
        <p className="text-xs text-muted">
          You&apos;ll need a candidate profile before applying. We&apos;ll walk
          you through it.
        </p>
      ) : null}
      {viewerState === "candidate" ? (
        <p className="text-xs text-muted">
          Applies use the resume and profile on{" "}
          <Link
            href="/me/profile"
            className="underline underline-offset-2 hover:text-foreground"
          >
            your candidate profile
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
