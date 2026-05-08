import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/auth/employer";
import {
  RESUME_SIGNED_URL_EXPIRY_LABEL,
  getResumeSignedUrl,
} from "@/lib/storage/resume-url";
import { safeHref } from "@/lib/url";

import {
  markApplicantOpened,
  saveApplicantNotes,
  setApplicantStatus,
} from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string; appId: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const types: Array<"certification" | "role_history" | "education"> = [
    "certification",
    "role_history",
    "education",
  ];
  return types
    .map((type) => ({
      type,
      items: (creds ?? []).filter((c) => c?.credential_type === type),
    }))
    .filter((g) => g.items.length > 0);
}

export default async function EmployerApplicantDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug, id: jobId, appId } = await params;
  const sp = await searchParams;

  const { supabase, org } = await requireOrgMember(orgSlug);

  // First-open auto-transition `submitted` -> `under_review`. Fire-and-forget;
  // swallow errors so a bad transition never blocks viewing the application.
  await markApplicantOpened(orgSlug, jobId, appId);

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
        jobs!inner (
          id,
          slug,
          title,
          organization_id
        )
      `,
    )
    .eq("id", appId)
    .maybeSingle();

  if (error || !app) notFound();

  const jobNode = Array.isArray(app.jobs) ? app.jobs[0] : app.jobs;
  if (!jobNode || jobNode.organization_id !== org.id || jobNode.id !== jobId) {
    notFound();
  }

  const snapshot = (app.profile_snapshot ?? {}) as ProfileSnapshot;
  const credentialsByType = groupCredentials(snapshot.credentials ?? []);
  const updated = sp.updated === "1";
  const notesSaved = sp.notes_saved === "1";
  const errorMsg = typeof sp.error === "string" ? sp.error : null;

  // Signed URL for the resume snapshot. 15 min is enough for a download + a
  // couple of re-opens in the tab, short enough that a leaked link stops
  // working quickly.
  const resumeUrl = await getResumeSignedUrl(
    supabase,
    app.resume_snapshot_path,
  );

  const terminal = app.status === "hired" || app.status === "withdrawn";
  const statusAction = setApplicantStatus.bind(null, orgSlug, jobId);
  const notesAction = saveApplicantNotes.bind(null, orgSlug, jobId);

  return (
    <div className="py-6">
      <Link
        href={`/employer/${orgSlug}/jobs/${jobId}/applicants`}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        All applicants · {jobNode.title}
      </Link>

      {updated ? (
        <p className="mt-4 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Status updated.
        </p>
      ) : null}
      {notesSaved ? (
        <p className="mt-4 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Notes saved.
        </p>
      ) : null}
      {errorMsg ? (
        <p className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

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

      {!terminal ? (
        <section className="mt-6 border border-hairline p-6">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Move this application
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {app.status !== "under_review" ? (
              <form action={statusAction}>
                <input type="hidden" name="application_id" value={app.id} />
                <input type="hidden" name="status" value="under_review" />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center border border-hairline px-4 text-xs font-medium uppercase tracking-[0.12em] text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  Mark in review
                </button>
              </form>
            ) : null}
            {app.status !== "shortlisted" ? (
              <form action={statusAction}>
                <input type="hidden" name="application_id" value={app.id} />
                <input type="hidden" name="status" value="shortlisted" />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.12em] text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Shortlist
                </button>
              </form>
            ) : null}
            {app.status !== "rejected" ? (
              <form action={statusAction}>
                <input type="hidden" name="application_id" value={app.id} />
                <input type="hidden" name="status" value="rejected" />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center border border-hairline px-4 text-xs font-medium uppercase tracking-[0.12em] text-muted transition-colors hover:border-red-500 hover:text-red-600"
                >
                  Not a fit
                </button>
              </form>
            ) : null}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Candidates see the current status on their dashboard, but they
            don&apos;t see your private notes below. Hiring decisions come later
            when you close the listing.
          </p>
        </section>
      ) : (
        <section className="mt-6 border border-hairline p-6">
          <p className="text-sm text-muted">
            {app.status === "withdrawn"
              ? "The candidate withdrew this application."
              : "This application has been finalized."}
          </p>
        </section>
      )}

      <section className="mt-8 border border-hairline p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Application snapshot
        </h2>
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
            <dd className="mt-1 text-foreground">
              {formatWorkStyle(snapshot)}
            </dd>
          </div>
          {snapshot.applicant_email ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted">
                Contact email
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
                {RESUME_SIGNED_URL_EXPIRY_LABEL}
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
                        <p className="mt-0.5 text-muted">{c.organization_name}</p>
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

      <section className="mt-8 border border-hairline p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Private notes
        </h2>
        <p className="mt-2 text-xs text-muted">
          Only your organization and TheCOE admins see this. Candidates never
          see these notes.
        </p>
        <form action={notesAction} className="mt-4 space-y-4">
          <input type="hidden" name="application_id" value={app.id} />
          <label htmlFor="employer_notes" className="sr-only">
            Private employer notes
          </label>
          <textarea
            id="employer_notes"
            name="employer_notes"
            rows={6}
            maxLength={4000}
            defaultValue={app.employer_notes ?? ""}
            placeholder="Screening impressions, follow-up items, interview feedback…"
            className="w-full border border-hairline bg-surface px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
              4,000 character limit
            </p>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center border border-foreground bg-foreground px-4 text-xs font-medium uppercase tracking-[0.12em] text-background transition-colors hover:border-accent hover:bg-accent hover:text-on-accent"
            >
              Save notes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
