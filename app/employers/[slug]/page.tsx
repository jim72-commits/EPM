import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAppBaseUrl } from "@/lib/app-url";
import {
  formatCountry,
  formatEmploymentType,
  formatPublishedDate,
  formatRemotePolicy,
} from "@/lib/format-job";
import { getOrgLogoUrl } from "@/lib/org-logo-url";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  organization_type: "direct" | "agency";
  country_code: "US" | "CA";
  verified: boolean;
  logo_storage_path: string | null;
  website_url: string | null;
  bio: string | null;
  created_at: string;
};

type OpenJobRow = {
  id: string;
  slug: string;
  title: string;
  remote_policy: "remote" | "hybrid" | "onsite" | "flexible";
  employment_type: "full_time" | "part_time" | "contract";
  country_code: "US" | "CA";
  location_label: string | null;
  published_at: string | null;
  is_featured: boolean | null;
  featured_until: string | null;
  platforms: { name: string; is_active?: boolean } | { name: string; is_active?: boolean }[] | null;
};

function isActivelyFeatured(flag: boolean | null, until: string | null): boolean {
  if (!flag) return false;
  if (!until) return true;
  const ends = Date.parse(until);
  if (Number.isNaN(ends)) return true;
  return ends > Date.now();
}

function firstRel<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isSupabaseConfigured()) {
    return { title: "Employer" };
  }

  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, bio")
    .eq("slug", slug)
    .maybeSingle();

  const row = data as { id: string; name: string; bio: string | null } | null;
  if (!row) {
    return { title: "Employer not found" };
  }

  // Orgs with zero open listings are dead pages from a discovery POV — we
  // don't want Google indexing thousands of empty employer pages and we
  // definitely don't want to spend budget building rich OG cards for them.
  // The page itself still renders for direct visitors (with a "no open roles"
  // message), but search engines should skip it.
  const { count: openJobCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", row.id)
    .eq("status", "open");

  if (!openJobCount) {
    return {
      title: `${row.name} · Employer on TheCOE`,
      robots: { index: false, follow: false },
    };
  }

  const description =
    row.bio?.trim().slice(0, 200) ??
    `${row.name} hires Anaplan talent on TheCOE.`;
  const baseUrl = getAppBaseUrl();
  return {
    title: `${row.name} · Employer on TheCOE`,
    description,
    alternates: { canonical: `${baseUrl}/employers/${slug}` },
    openGraph: {
      title: `${row.name} · TheCOE`,
      description,
      url: `${baseUrl}/employers/${slug}`,
      type: "website",
    },
  };
}

export default async function PublicOrgPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    // Public org pages are inherently database-driven — render a friendly
    // dev-mode placeholder rather than 404.
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
        <p className="text-xs uppercase tracking-[0.12em] text-muted">
          Dev mode
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Employer pages need Supabase
        </h1>
        <p className="mt-4 text-sm text-muted">
          Configure your Supabase env vars to see employer pages.
        </p>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data: orgData } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, organization_type, country_code, verified, logo_storage_path, website_url, bio, created_at",
    )
    .eq("slug", slug)
    .maybeSingle();

  const org = orgData as OrgRow | null;
  if (!org) notFound();

  const { data: openJobsData } = await supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        remote_policy,
        employment_type,
        country_code,
        location_label,
        published_at,
        is_featured,
        featured_until,
        platforms!inner ( name, is_active )
      `,
    )
    .eq("organization_id", org.id)
    .eq("status", "open")
    .eq("platforms.is_active", true)
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false });

  const openJobs = (openJobsData ?? []) as OpenJobRow[];

  const logoUrl = getOrgLogoUrl(org.logo_storage_path);
  const baseUrl = getAppBaseUrl();
  const orgUrl = `${baseUrl}/employers/${org.slug}`;

  // Schema.org Organization JSON-LD — picked up by SERPs and helps the
  // employer's brand surface organically.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    url: org.website_url ?? orgUrl,
    logo: logoUrl ?? undefined,
    description: org.bio ?? undefined,
    address:
      org.country_code === "US"
        ? { "@type": "PostalAddress", addressCountry: "US" }
        : { "@type": "PostalAddress", addressCountry: "CA" },
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-16 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/jobs"
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        All jobs
      </Link>

      <header className="mt-8 flex flex-wrap items-start gap-6 border-b border-hairline pb-8">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden border border-hairline bg-surface">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${org.name} logo`}
              width={72}
              height={72}
              className="h-[72px] w-[72px] object-contain"
              unoptimized
            />
          ) : (
            <span className="text-base font-semibold tracking-tight text-muted">
              {org.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            {org.organization_type === "agency" ? "Hiring agency" : "Employer"}{" "}
            · {formatCountry(org.country_code)}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {org.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            {org.verified ? (
              <span className="inline-flex items-center border border-foreground/30 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground">
                Verified
              </span>
            ) : null}
            {org.website_url ? (
              <a
                href={org.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {prettyUrl(org.website_url)}
              </a>
            ) : null}
            <span>On TheCOE since {formatPublishedDate(org.created_at)}</span>
          </div>
        </div>
      </header>

      {org.bio ? (
        <section className="mt-10 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-foreground">
          {org.bio}
        </section>
      ) : (
        <section className="mt-10 max-w-3xl text-sm leading-relaxed text-muted">
          {org.name} hasn&apos;t added a bio yet.
        </section>
      )}

      <section className="mt-12 border-t border-hairline pt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Open roles
        </h2>
        {openJobs.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No open roles right now. Check back, or{" "}
            <Link
              href="/alerts"
              className="underline underline-offset-2 hover:text-foreground"
            >
              set up an alert
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-hairline border border-hairline bg-surface">
            {openJobs.map((job) => {
              const featured = isActivelyFeatured(
                job.is_featured,
                job.featured_until,
              );
              const platform = firstRel(job.platforms);
              return (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.slug}`}
                    className={
                      featured
                        ? "flex flex-wrap items-baseline justify-between gap-3 border-l-2 border-l-accent bg-accent/5 px-4 py-4 hover:bg-page md:px-5"
                        : "flex flex-wrap items-baseline justify-between gap-3 px-4 py-4 hover:bg-page md:px-5"
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">
                          {job.title}
                        </p>
                        {featured ? (
                          <span className="inline-flex items-center border border-accent bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                            Featured
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {platform?.name ?? "Anaplan"} ·{" "}
                        {formatRemotePolicy(job.remote_policy)} ·{" "}
                        {formatEmploymentType(job.employment_type)} ·{" "}
                        {formatCountry(job.country_code)}
                      </p>
                    </div>
                    <p className="text-xs text-muted">
                      {job.location_label ?? "Location on request"}
                      <span className="mx-2">|</span>
                      Posted {formatPublishedDate(job.published_at)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function prettyUrl(value: string): string {
  try {
    const u = new URL(value);
    return u.host.replace(/^www\./, "");
  } catch {
    return value;
  }
}
