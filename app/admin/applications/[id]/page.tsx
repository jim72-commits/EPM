import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin";
import { getUsersByIds } from "@/lib/admin/users";
import { getResumeSignedUrl } from "@/lib/storage/resume-url";
import { safeHref } from "@/lib/url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application detail",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
};

type ProfileSnapshot = {
  full_name?: string;
  headline?: string | null;
  country_code?: "US" | "CA";
  location_label?: string | null;
  work_auth_us?: string;
  work_auth_ca?: string;
  years_experience_anaplan?: number;
  open_to_remote?: boolean;
  open_to_hybrid?: boolean;
  open_to_onsite?: boolean;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  bio?: string | null;
  applicant_email?: string | null;
  credentials?: Array<{
    credential_type?: "certification" | "role_history" | "education";
    title?: string;
    organization_name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
  }>;
};

function statusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "New";
    case "under_review":
      return "In review";
    case "shortlisted":
      return "Shortlisted";
    case "rejected":
      return "Rejected";
    case "hired":
      return "Hired";
    case "withdrawn":
      return "Withdrawn by candidate";
    default:
      return status;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "submitted":
      return "border-accent text-accent";
    case "under_review":
      return "border-hairline text-foreground";
    case "shortlisted":
      return "border-accent bg-accent/5 text-accent";
    case "hired":
      return "border-green-600 text-green-700";
    case "rejected":
    case "withdrawn":
      return "border-hairline text-muted";
    default:
      return "border-hairline text-muted";
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatWorkAuth(
  country: "US" | "CA" | undefined,
  us?: string,
  ca?: string,
): string {
  const v = country === "CA" ? ca : us;
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

function formatWorkStyle(p: ProfileSnapshot): string {
  const parts: string[] = [];
  if (p.open_to_remote) parts.push("Remote");
  if (p.open_to_hybrid) parts.push("Hybrid");
  if (p.open_to_onsite) parts.push("Onsite");
  return parts.length ? parts.join(" · ") : "Not specified";
}

function credentialHeading(type: string | undefined): string {
  switch (type) {
    case "certification":
      return "Certifications";
    case "role_history":
      return "Role history";
    case "education":
      return "Education";
    default:
      return "Other";
  }
}

function groupCredentials(creds: ProfileSnapshot["credentials"] = []): Array<{
  type: "certification" | "role_history" | "education";
  items: NonNullable<ProfileSnapshot["credentials"]>;
}> {
  const order: Array<"certification" | "role_history" | "education"> = [
    "certification",
    "role_history",
    "education",
  ];
  return order
    .map((type) => ({
      type,
      items: (creds ?? []).filter((c) => c?.credential_type === type),
    }))
    .filter((g) => g.items.length > 0);
}

export default async function AdminApplicationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const { data: app, error } = await supabase
    .from("job_applications")
    .select(
      `
        id,
        status,
        applied_at,
        status_updated_at,
        cover_letter,
        resume_snapshot_path,
        profile_snapshot,
        employer_notes,
        candidate_user_id,
        jobs (
          id,
          slug,
          title,
          status,
          organizations:organization_id ( id, name, slug )
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !app) notFound();

  const jobNode = Array.isArray(app.jobs) ? app.jobs[0] : app.jobs;
  const orgNode = jobNode
    ? Array.isArray(jobNode.organizations)
      ? jobNode.organizations[0]
      : jobNode.organizations
    : null;

  const snapshot = (app.profile_snapshot ?? {}) as ProfileSnapshot;
  const credentialsByType = groupCredentials(snapshot.credentials ?? []);

  const users = await getUsersByIds([app.candidate_user_id]);
  const candidateEmail = users.get(app.candidate_user_id)?.email ?? null;

  // Generate a signed URL for the resume snapshot. 15 min matches the
  // employer-side TTL so admins and employers see the same lifespan.
  const resumeUrl = await getResumeSignedUrl(
    supabase,
    app.resume_snapshot_path,
  );

  return (
    <div className="py-6">
      <Link
        href="/admin/applications"
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        ← All applications
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {snapshot.full_name ?? "Candidate"}
          </h1>
          {snapshot.headline ? (
            <p className="mt-2 text-sm text-foreground">{snapshot.headline}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Applied {formatDate(app.applied_at)}
            {app.status_updated_at !== app.applied_at
              ? ` · Last update ${formatDate(app.status_updated_at)}`
              : ""}
          </p>
        </div>
        <span
          className={`inline-flex border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] ${statusTone(app.status)}`}
        >
          {statusLabel(app.status)}
        </span>
      </header>

      <section className="mt-6 border border-hairline p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Admin context
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Application id
            </dt>
            <dd className="mt-1 break-all font-mono text-[11px] text-foreground">
              {app.id}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Candidate user id
            </dt>
            <dd className="mt-1 break-all font-mono text-[11px] text-foreground">
              {app.candidate_user_id}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Auth email
            </dt>
            <dd className="mt-1 break-all text-foreground">
              {candidateEmail ? (
                <a
                  href={`mailto:${candidateEmail}`}
                  className="underline underline-offset-2 hover:text-accent"
                >
                  {candidateEmail}
                </a>
              ) : (
                <span className="text-muted">Unavailable</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Job
            </dt>
            <dd className="mt-1 text-foreground">
              {jobNode ? (
                <>
                  <span className="font-medium">{jobNode.title}</span>
                  <span className="ml-2 text-muted">({jobNode.status})</span>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    <Link
                      href={`/admin/jobs/${jobNode.id}/edit`}
                      className="underline underline-offset-2 hover:text-accent"
                    >
                      Edit in admin
                    </Link>
                    <Link
                      href={`/jobs/${jobNode.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-accent"
                    >
                      View public listing
                    </Link>
                  </div>
                </>
              ) : (
                <span className="text-muted">Listing missing</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Organization
            </dt>
            <dd className="mt-1 text-foreground">
              {orgNode ? (
                <>
                  <span className="font-medium">{orgNode.name}</span>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    <Link
                      href={`/admin/organizations/${orgNode.id}/edit`}
                      className="underline underline-offset-2 hover:text-accent"
                    >
                      Edit in admin
                    </Link>
                    <Link
                      href={`/admin/organizations/${orgNode.id}/members`}
                      className="underline underline-offset-2 hover:text-accent"
                    >
                      Members
                    </Link>
                    <Link
                      href={`/employers/${orgNode.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2 hover:text-accent"
                    >
                      Public profile
                    </Link>
                  </div>
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 border border-hairline p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Application snapshot
        </h2>
        <p className="mt-2 text-xs text-muted">
          What the employer sees. Snapshotted at the time of submission and
          frozen for the life of the application.
        </p>
        <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Anaplan experience
            </dt>
            <dd className="mt-1 text-foreground">
              {typeof snapshot.years_experience_anaplan === "number"
                ? `${snapshot.years_experience_anaplan} year${snapshot.years_experience_anaplan === 1 ? "" : "s"}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Based in
            </dt>
            <dd className="mt-1 text-foreground">
              {snapshot.location_label?.trim() ||
                (snapshot.country_code === "US"
                  ? "United States"
                  : snapshot.country_code === "CA"
                    ? "Canada"
                    : "—")}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Work authorization
            </dt>
            <dd className="mt-1 text-foreground">
              {formatWorkAuth(
                snapshot.country_code,
                snapshot.work_auth_us,
                snapshot.work_auth_ca,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Work style
            </dt>
            <dd className="mt-1 text-foreground">{formatWorkStyle(snapshot)}</dd>
          </div>
          {snapshot.applicant_email ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted">
                Snapshot email
              </dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${snapshot.applicant_email}`}
                  className="text-foreground underline underline-offset-2 hover:text-accent"
                >
                  {snapshot.applicant_email}
                </a>
              </dd>
            </div>
          ) : null}
          {(() => {
            const linkedinHref = safeHref(snapshot.linkedin_url);
            return linkedinHref ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-muted">
                  LinkedIn
                </dt>
                <dd className="mt-1">
                  <a
                    href={linkedinHref}
                    className="text-foreground underline underline-offset-2 hover:text-accent"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {linkedinHref}
                  </a>
                </dd>
              </div>
            ) : null;
          })()}
          {(() => {
            const portfolioHref = safeHref(snapshot.portfolio_url);
            return portfolioHref ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-muted">
                  Portfolio
                </dt>
                <dd className="mt-1">
                  <a
                    href={portfolioHref}
                    className="text-foreground underline underline-offset-2 hover:text-accent"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {portfolioHref}
                  </a>
                </dd>
              </div>
            ) : null;
          })()}
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">
              Resume
            </dt>
            <dd className="mt-1">
              {resumeUrl ? (
                <a
                  href={resumeUrl}
                  className="inline-flex h-9 items-center justify-center border border-foreground bg-foreground px-4 text-xs font-medium uppercase tracking-[0.12em] text-background transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download resume (PDF)
                </a>
              ) : (
                <span className="text-muted">Unavailable</span>
              )}
              <span className="ml-3 text-xs text-muted">
                Link expires in 15 minutes.
              </span>
            </dd>
          </div>
          {snapshot.bio ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-[0.1em] text-muted">
                Bio
              </dt>
              <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground">
                {snapshot.bio}
              </dd>
            </div>
          ) : null}
        </dl>

        {credentialsByType.length > 0 ? (
          <div className="mt-8 space-y-6 border-t border-hairline pt-6">
            {credentialsByType.map(({ type, items }) => (
              <div key={type}>
                <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  {credentialHeading(type)}
                </h3>
                <ul className="mt-3 space-y-3">
                  {items.map((c, i) => (
                    <li
                      key={`${type}-${i}`}
                      className="text-sm text-foreground"
                    >
                      <p className="font-medium">{c.title ?? "—"}</p>
                      {c.organization_name ? (
                        <p className="mt-0.5 text-muted">
                          {c.organization_name}
                        </p>
                      ) : null}
                      {c.start_date || c.end_date ? (
                        <p className="mt-0.5 text-xs uppercase tracking-[0.08em] text-muted">
                          {c.start_date ?? "—"}
                          {c.end_date ? ` — ${c.end_date}` : " — present"}
                        </p>
                      ) : null}
                      {c.description ? (
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed text-muted">
                          {c.description}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {app.cover_letter ? (
        <section className="mt-8 border border-hairline p-6">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Cover letter
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {app.cover_letter}
          </p>
        </section>
      ) : null}

      {app.employer_notes ? (
        <section className="mt-8 border border-hairline p-6">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Employer notes
          </h2>
          <p className="mt-2 text-xs text-muted">
            Visible only to the employer&apos;s organization and TheCOE
            admins. Candidates never see these.
          </p>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {app.employer_notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
