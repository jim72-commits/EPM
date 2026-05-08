import Link from "next/link";
import { notFound } from "next/navigation";

import { WithdrawApplicationButton } from "@/components/withdraw-application-button";
import { requireCandidate } from "@/lib/auth/candidate";
import { getResumeSignedUrl } from "@/lib/storage/resume-url";
import { safeHref } from "@/lib/url";

import { withdrawApplication } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
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
      return "Submitted";
    case "under_review":
      return "Under review";
    case "shortlisted":
      return "Shortlisted";
    case "rejected":
      return "Not moving forward";
    case "hired":
      return "Hired";
    case "withdrawn":
      return "Withdrawn";
    default:
      return status;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "submitted":
    case "under_review":
      return "border-hairline text-foreground";
    case "shortlisted":
      return "border-accent text-accent";
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

function formatWorkAuth(country: "US" | "CA" | undefined, us?: string, ca?: string): string {
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

export default async function ApplicationDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const { user, supabase } = await requireCandidate();

  const submitted = sp.submitted === "1";
  const withdrew = sp.withdrew === "1";
  const alreadyApplied = sp.already_applied === "1";
  const errorMsg = typeof sp.error === "string" ? sp.error : null;

  const { data, error } = await supabase
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
        jobs (
          id,
          slug,
          title,
          status,
          organizations ( name )
        )
      `,
    )
    .eq("id", id)
    .eq("candidate_user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const jobNode = Array.isArray(data.jobs) ? data.jobs[0] : data.jobs;
  const orgNode = jobNode && "organizations" in jobNode
    ? Array.isArray(jobNode.organizations)
      ? jobNode.organizations[0]
      : jobNode.organizations
    : null;
  const orgName = orgNode && typeof orgNode === "object" && "name" in orgNode
    ? (orgNode as { name: string }).name
    : "Employer";
  const jobTitle = jobNode && typeof jobNode === "object" && "title" in jobNode
    ? (jobNode as { title: string }).title
    : "Role";
  const jobSlug = jobNode && typeof jobNode === "object" && "slug" in jobNode
    ? (jobNode as { slug: string }).slug
    : null;
  const jobId = jobNode && typeof jobNode === "object" && "id" in jobNode
    ? (jobNode as { id: string }).id
    : null;
  const listingStatus = jobNode && typeof jobNode === "object" && "status" in jobNode
    ? (jobNode as { status: string }).status
    : null;
  // jobs.status enum is draft|open|filled|unpublished — `filled` is the only
  // post-close state. There's no `closed` value in the schema.
  const listingClosed = listingStatus === "filled";

  // For closed listings, fetch the outcome so the in-app banner matches the
  // email body the candidate already received. We pull from a candidate-
  // visible view that hides operator-only fields (feedback, closed_by, …).
  let closeOutcome:
    | "hired_here"
    | "hired_elsewhere"
    | "not_hired_no_fit"
    | "not_hired_cancelled"
    | null = null;
  if (listingClosed && jobId) {
    const { data: signal } = await supabase
      .from("candidate_outcome_signals")
      .select("outcome")
      .eq("job_id", jobId)
      .maybeSingle();
    const raw = signal?.outcome;
    if (
      raw === "hired_here" ||
      raw === "hired_elsewhere" ||
      raw === "not_hired_no_fit" ||
      raw === "not_hired_cancelled"
    ) {
      closeOutcome = raw;
    }
  }

  const snapshot = (data.profile_snapshot ?? {}) as ProfileSnapshot;
  const canWithdraw = ["submitted", "under_review", "shortlisted"].includes(
    data.status,
  );

  // Signed URL so the candidate can re-download exactly what the employer sees.
  // TTL is centralized in lib/storage/resume-url so every surface in the app
  // (employer/applicant, admin, candidate) gets the same lifetime.
  const resumeUrl = await getResumeSignedUrl(
    supabase,
    data.resume_snapshot_path,
  );

  const credentialsByType = groupCredentials(snapshot.credentials ?? []);

  return (
    <div className="py-6">
      <Link
        href="/me/applications"
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        All applications
      </Link>

      {submitted ? (
        <p className="mt-4 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Application submitted. The hiring team at {orgName} will review it.
        </p>
      ) : null}
      {withdrew ? (
        <p className="mt-4 border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          You withdrew this application.
        </p>
      ) : null}
      {alreadyApplied ? (
        <p className="mt-4 border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          You already have an active application for this role.
        </p>
      ) : null}
      {data.status === "hired" ? (
        <div className="mt-4 border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
          <p className="font-medium">
            {orgName} hired you for this role.
          </p>
          <p className="mt-1 text-xs text-green-700">
            Congrats. We track this on both sides — your hire counts toward
            our success rate, and {orgName}&apos;s record shows they actually
            fill roles here.
          </p>
        </div>
      ) : null}
      {data.status === "rejected" && jobSlug ? (
        <ClosedBanner
          listingClosed={listingClosed}
          outcome={closeOutcome}
          orgName={orgName}
          jobTitle={jobTitle}
        />
      ) : null}
      {errorMsg ? (
        <p className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {jobTitle}
          </h1>
          <p className="mt-2 text-sm text-muted">{orgName}</p>
          <p className="mt-1 text-xs text-muted">
            Applied {formatDate(data.applied_at)}
            {data.status_updated_at !== data.applied_at
              ? ` · Last update ${formatDate(data.status_updated_at)}`
              : ""}
          </p>
        </div>
        <span
          className={`inline-flex border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] ${statusTone(data.status)}`}
        >
          {statusLabel(data.status)}
        </span>
      </header>

      <section className="mt-8 border border-hairline p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          What the employer saw
        </h2>
        <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">Name</dt>
            <dd className="mt-1 text-foreground">
              {snapshot.full_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">Headline</dt>
            <dd className="mt-1 text-foreground">
              {snapshot.headline?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">Based in</dt>
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
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">Work style</dt>
            <dd className="mt-1 text-foreground">{formatWorkStyle(snapshot)}</dd>
          </div>
          {(() => {
            const linkedinHref = safeHref(snapshot.linkedin_url);
            return linkedinHref ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-muted">LinkedIn</dt>
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
                <dt className="text-xs uppercase tracking-[0.1em] text-muted">Portfolio</dt>
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
            <dt className="text-xs uppercase tracking-[0.1em] text-muted">Resume</dt>
            <dd className="mt-1">
              {resumeUrl ? (
                <a
                  href={resumeUrl}
                  className="text-foreground underline underline-offset-2 hover:text-accent"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download the resume the employer received
                </a>
              ) : (
                <span className="text-muted">Unavailable</span>
              )}
            </dd>
          </div>
          {snapshot.bio ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-[0.1em] text-muted">Bio</dt>
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
                    <li key={`${type}-${i}`} className="text-sm text-foreground">
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

      {data.cover_letter ? (
        <section className="mt-8 border border-hairline p-6">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Cover letter
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {data.cover_letter}
          </p>
        </section>
      ) : null}

      <section className="mt-8 flex flex-wrap items-center gap-4 border-t border-hairline pt-6">
        {jobSlug ? (
          <Link
            href={`/jobs/${jobSlug}`}
            className="inline-flex h-10 items-center justify-center border border-hairline px-5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            View posting
          </Link>
        ) : null}
        {canWithdraw ? (
          <WithdrawApplicationButton
            withdrawAction={withdrawApplication.bind(null, id)}
            status={
              data.status as "submitted" | "under_review" | "shortlisted"
            }
          />
        ) : null}
      </section>
    </div>
  );
}

function ClosedBanner({
  listingClosed,
  outcome,
  orgName,
  jobTitle,
}: {
  listingClosed: boolean;
  outcome:
    | "hired_here"
    | "hired_elsewhere"
    | "not_hired_no_fit"
    | "not_hired_cancelled"
    | null;
  orgName: string;
  jobTitle: string;
}) {
  // Wording mirrors lib/email/status-templates.ts so the in-app banner
  // matches the email the candidate already got. If the close kind isn't
  // available (older closures pre-outcome-tracking, or a manual rejection
  // before close), we fall back to a softer generic line.
  //
  // Note: this banner only renders for `data.status === "rejected"`, so the
  // hired candidate never sees it (they get the dedicated green "you got the
  // role" panel above). For `hired_here` we say the team moved forward with
  // someone else without naming them — same factual content as the email.
  let body: string;
  if (listingClosed && outcome === "hired_here") {
    body = `${orgName} closed their listing for ${jobTitle} and moved forward with another candidate. Other Anaplan roles are open — keep applying, or set up an alert.`;
  } else if (listingClosed && outcome === "hired_elsewhere") {
    body = `${orgName} closed their listing for ${jobTitle}. They filled the role through a different channel, so it wasn't a no on you specifically — there just isn't an open seat to move you into.`;
  } else if (listingClosed && outcome === "not_hired_no_fit") {
    body = `${orgName} closed their listing for ${jobTitle} without making a hire. Sometimes teams reset their bar, sometimes they pause. Either way, this one is done.`;
  } else if (listingClosed && outcome === "not_hired_cancelled") {
    body = `${orgName} pulled the listing for ${jobTitle} — usually means headcount changed or the role was scrapped. Not a reflection of your application.`;
  } else if (listingClosed) {
    body = `${orgName} closed the listing for ${jobTitle}. Keep applying to other roles, or set up an alert.`;
  } else {
    body = `${orgName} has decided not to move forward with this application. The role may still be open to other candidates — keep applying, or set up an alert for similar roles.`;
  }
  return (
    <p className="mt-4 border border-hairline bg-surface px-4 py-3 text-sm text-muted">
      {body}
    </p>
  );
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
