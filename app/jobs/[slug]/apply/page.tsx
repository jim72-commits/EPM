import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getOptionalAuth } from "@/lib/auth/admin";
import {
  getOptionalCandidateProfile,
  isProfileApplyReady,
} from "@/lib/auth/candidate";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { submitApplication } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Apply · ${slug}`,
    robots: { index: false, follow: false },
  };
}

function formatYears(n: number): string {
  if (n <= 0) return "No Anaplan experience logged";
  if (n === 1) return "1 year of Anaplan experience";
  return `${n} years of Anaplan experience`;
}

function formatWorkStyle(p: {
  open_to_remote: boolean;
  open_to_hybrid: boolean;
  open_to_onsite: boolean;
}): string {
  const parts: string[] = [];
  if (p.open_to_remote) parts.push("Remote");
  if (p.open_to_hybrid) parts.push("Hybrid");
  if (p.open_to_onsite) parts.push("Onsite");
  return parts.length ? parts.join(" · ") : "Not specified";
}

function formatWorkAuth(
  countryCode: "US" | "CA",
  us: string,
  ca: string,
): string {
  const v = countryCode === "US" ? us : ca;
  switch (v) {
    case "citizen":
      return "Citizen";
    case "permanent_resident":
      return "Permanent resident";
    case "visa_required":
      return "Visa / sponsorship required";
    case "none":
      return "Not authorized";
    default:
      return "Not specified";
  }
}

export default async function ApplyPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const errorMsg = typeof sp.error === "string" ? sp.error : null;

  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-20 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Applications require a live database connection.
        </h1>
        <p className="mt-4 text-sm text-muted">
          Development mode: Supabase is not configured in this environment.
        </p>
      </main>
    );
  }

  // Fetch the job with extra fields we need for gating + the form preview.
  const supabase = await createServerSupabaseClient();
  const { data: job } = await supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        listing_kind,
        status,
        country_code,
        location_label,
        remote_policy,
        employment_type,
        organizations ( name, slug )
      `,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!job) notFound();

  const org = Array.isArray(job.organizations)
    ? job.organizations[0]
    : job.organizations;

  // In-product applications are only supported on open, employer-posted
  // listings. Syndicated listings link out to the employer's own apply form.
  if (job.status !== "open" || job.listing_kind !== "employer") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-20 lg:px-8">
        <Link
          href={`/jobs/${slug}`}
          className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
        >
          Back to role
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
          This role is not accepting applications on TheCOE.
        </h1>
        <p className="mt-4 text-sm text-muted">
          Open the listing for a direct apply link, if the employer provided
          one.
        </p>
      </main>
    );
  }

  const auth = await getOptionalAuth();
  const nextParam = `/jobs/${slug}/apply`;

  // Unauthenticated → show dual CTA without a destructive redirect.
  if (!auth.user) {
    return (
      <ApplyShell slug={slug} title={job.title} orgName={org?.name ?? ""}>
        <div className="border border-hairline p-8">
          <h2 className="text-base font-semibold text-foreground">
            Sign in to apply
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Applying on TheCOE needs a candidate account so the hiring team
            can see your resume, experience, and credentials.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(nextParam)}`}
              className="inline-flex h-10 items-center justify-center border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
            >
              Sign in
            </Link>
            <Link
              href="/signup/candidate"
              className="inline-flex h-10 items-center justify-center border border-hairline px-5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Create a candidate account
            </Link>
          </div>
        </div>
      </ApplyShell>
    );
  }

  // Signed in but no candidate profile — they might be an employer or admin
  // without a candidate side to their account. Nudge them into one.
  if (!auth.hasCandidateProfile) {
    return (
      <ApplyShell slug={slug} title={job.title} orgName={org?.name ?? ""}>
        <div className="border border-hairline p-8">
          <h2 className="text-base font-semibold text-foreground">
            Create a candidate profile to apply
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Your current account doesn&apos;t have a candidate profile.
            Applications on TheCOE require one — employers need to see your
            resume, experience, and credentials.
          </p>
          <Link
            href="/signup/candidate"
            className="mt-6 inline-flex h-10 items-center justify-center border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
          >
            Create candidate profile
          </Link>
        </div>
      </ApplyShell>
    );
  }

  const profile = await getOptionalCandidateProfile();
  if (!profile) {
    redirect(`/signup/candidate?next=${encodeURIComponent(nextParam)}`);
  }

  // Profile exists but not strong enough to apply.
  if (!isProfileApplyReady(profile)) {
    const missing: string[] = [];
    if (!profile.resume_path) missing.push("resume");
    if (profile.full_name.trim().length === 0) missing.push("full name");
    return (
      <ApplyShell slug={slug} title={job.title} orgName={org?.name ?? ""}>
        <div className="border border-hairline p-8">
          <h2 className="text-base font-semibold text-foreground">
            Finish your profile before applying
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Employers only see what&apos;s on your profile at the moment you
            submit. To keep signal high, a resume and basic details are
            required before you can apply.
          </p>
          {missing.length > 0 ? (
            <p className="mt-4 text-sm text-foreground">
              Still missing:{" "}
              <span className="font-medium">{missing.join(", ")}</span>
            </p>
          ) : null}
          <Link
            href="/me/profile"
            className="mt-6 inline-flex h-10 items-center justify-center border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
          >
            Edit profile
          </Link>
        </div>
      </ApplyShell>
    );
  }

  // Already applied — short-circuit to the application record.
  const { data: existing } = await supabase
    .from("job_applications")
    .select("id, status")
    .eq("job_id", job.id)
    .eq("candidate_user_id", auth.user.id)
    .maybeSingle();

  if (existing) {
    return (
      <ApplyShell slug={slug} title={job.title} orgName={org?.name ?? ""}>
        <div className="border border-hairline p-8">
          <h2 className="text-base font-semibold text-foreground">
            You&apos;ve already applied to this role.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Current status:{" "}
            <span className="font-medium text-foreground">
              {existing.status.replace("_", " ")}
            </span>
            .
          </p>
          <Link
            href={`/me/applications/${existing.id}`}
            className="mt-6 inline-flex h-10 items-center justify-center border border-foreground bg-foreground px-5 text-sm font-medium text-background transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
          >
            Open application
          </Link>
        </div>
      </ApplyShell>
    );
  }

  const credentialsCountResult = await supabase
    .from("candidate_credentials")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  const credentialsCount = credentialsCountResult.count ?? 0;

  return (
    <ApplyShell slug={slug} title={job.title} orgName={org?.name ?? ""}>
      {errorMsg === "withdrawn_reapply" ? (
        <div className="mb-6 border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">
            You previously withdrew an application for this role.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Reapplying isn&apos;t self-serve — drop us a note at{" "}
            <a
              href={`${SUPPORT_MAILTO}?subject=${encodeURIComponent(
                `Reapply request: ${job.title}`,
              )}`}
              className="font-medium underline underline-offset-2 hover:text-amber-700"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            and we&apos;ll work with the employer to reopen your application.
          </p>
        </div>
      ) : errorMsg ? (
        <p className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      <section className="border border-hairline p-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          What the employer will see
        </h2>
        <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Name
            </dt>
            <dd className="mt-1 text-foreground">{profile.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Headline
            </dt>
            <dd className="mt-1 text-foreground">
              {profile.headline?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Based in
            </dt>
            <dd className="mt-1 text-foreground">
              {profile.location_label?.trim() ||
                (profile.country_code === "US" ? "United States" : "Canada")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Anaplan experience
            </dt>
            <dd className="mt-1 text-foreground">
              {formatYears(profile.years_experience_anaplan)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Work authorization
            </dt>
            <dd className="mt-1 text-foreground">
              {formatWorkAuth(
                job.country_code as "US" | "CA",
                profile.work_auth_us,
                profile.work_auth_ca,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Work style
            </dt>
            <dd className="mt-1 text-foreground">
              {formatWorkStyle(profile)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Contact email
            </dt>
            <dd className="mt-1 text-foreground">
              {auth.user.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Resume
            </dt>
            <dd className="mt-1 text-foreground">PDF attached</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Credentials
            </dt>
            <dd className="mt-1 text-foreground">
              {credentialsCount}{" "}
              {credentialsCount === 1 ? "entry" : "entries"}
            </dd>
          </div>
          {profile.bio?.trim() ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-[0.1em] text-muted">
                Bio
              </dt>
              <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground">
                {profile.bio.trim()}
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-8 text-xs leading-relaxed text-muted">
          Your sign-in email is shared with the hiring team so they can
          contact you directly. Your profile is frozen at the moment you
          submit — later edits to your resume or profile will not change what
          they see for this application.
        </p>
        <p className="mt-3 text-xs">
          <Link
            href="/me/profile"
            className="text-muted underline underline-offset-2 hover:text-foreground"
          >
            Review profile before submitting
          </Link>
        </p>
      </section>

      <form
        action={submitApplication.bind(null, slug)}
        className="mt-10 space-y-6 border border-hairline p-8"
      >
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Cover letter
          </h2>
          <p className="mt-2 text-sm text-muted">
            Optional. A short note on why this specific role / company. Plain
            text, no formatting required.
          </p>
          <label htmlFor="cover_letter" className="sr-only">
            Cover letter
          </label>
          <textarea
            id="cover_letter"
            name="cover_letter"
            rows={8}
            maxLength={5000}
            placeholder="Why this role? (optional)"
            className="mt-4 w-full border border-hairline bg-surface px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-muted">
            5,000 character limit
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
          <p className="text-xs text-muted">
            By submitting you confirm the details above are accurate.
          </p>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Submit application
          </button>
        </div>
      </form>
    </ApplyShell>
  );
}

function ApplyShell({
  slug,
  title,
  orgName,
  children,
}: {
  slug: string;
  title: string;
  orgName: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8">
      <Link
        href={`/jobs/${slug}`}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        Back to role
      </Link>
      <header className="mt-6 border-b border-hairline pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Apply on TheCOE
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">{orgName}</p>
      </header>
      <div className="mt-10">{children}</div>
    </main>
  );
}
