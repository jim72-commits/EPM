import Link from "next/link";

import {
  getApplyReadyMissing,
  getProfilePolishMissing,
  requireCandidate,
} from "@/lib/auth/candidate";
import { formatCountry, formatPublishedDate } from "@/lib/format-job";

import {
  addCredential,
  deleteCredential,
  deleteResume,
  setDigestOptIn,
  updateCandidateProfile,
  uploadResume,
} from "./actions";

type CredentialRow = {
  id: string;
  credential_type: "certification" | "role_history" | "education";
  title: string;
  organization_name: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const inputClass =
  "mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
const sectionHeading =
  "text-xs font-medium uppercase tracking-[0.14em] text-muted";

const workAuthLabels: Record<string, string> = {
  none: "Not authorized",
  citizen: "Citizen",
  permanent_resident: "Permanent resident",
  visa_required: "Need sponsorship",
};

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (start && !end) return `${formatPublishedDate(start)} — Present`;
  if (!start && end) return `— ${formatPublishedDate(end)}`;
  return `${formatPublishedDate(start)} — ${formatPublishedDate(end)}`;
}

function resumeLabel(path: string | null): string {
  if (!path) return "No resume uploaded";
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function savedMessage(value: string): string {
  switch (value) {
    case "resume":
      return "Resume uploaded.";
    case "resume_deleted":
      return "Resume removed.";
    case "credential":
      return "Credential added.";
    case "credential_deleted":
      return "Credential removed.";
    case "digest_on":
      return "Weekly digest is on. We'll only email when there are matches.";
    case "digest_off":
      return "Weekly digest is off.";
    default:
      return "Profile saved.";
  }
}


export default async function CandidateProfilePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const welcome = sp.welcome === "1";
  const error =
    typeof sp.error === "string" ? sp.error : undefined;

  const { user, profile, supabase } = await requireCandidate();

  const { data: credentialsData } = await supabase
    .from("candidate_credentials")
    .select(
      "id, credential_type, title, organization_name, start_date, end_date, description, sort_order, created_at",
    )
    .eq("user_id", user.id)
    .order("credential_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const credentials = (credentialsData ?? []) as CredentialRow[];
  const byType = {
    certification: credentials.filter((c) => c.credential_type === "certification"),
    role_history: credentials.filter((c) => c.credential_type === "role_history"),
    education: credentials.filter((c) => c.credential_type === "education"),
  };

  const applyReadyMissing = getApplyReadyMissing(profile);
  const polishMissing = getProfilePolishMissing(profile);
  const isApplyReady = applyReadyMissing.length === 0;
  const isPolished = isApplyReady && polishMissing.length === 0;

  return (
    <div className="py-6">
      <header className="border-b border-hairline pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Candidate
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Your profile
        </h1>
        <p className="mt-2 text-sm text-muted">
          Everything here lives on your profile and travels with every
          application. Employers see the snapshot frozen at the moment you
          apply.
        </p>
      </header>

      {welcome ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Welcome to the circle. Round out the essentials below — a complete
          profile unlocks the apply button on any open role.
        </p>
      ) : null}
      {saved ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          {savedMessage(saved)}
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {!isApplyReady ? (
        <div className="mt-6 border border-accent bg-accent/5 px-4 py-3 text-sm text-foreground">
          <p className="font-medium text-accent">
            Profile not yet ready to apply.
          </p>
          <p className="mt-1 text-xs text-muted">
            Add: {applyReadyMissing.join(", ")}.
          </p>
        </div>
      ) : !isPolished ? (
        <div className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Apply-ready. Polish for a stronger pitch.</p>
          <p className="mt-1 text-xs text-muted">
            Optional but recommended: {polishMissing.join(", ")}.
          </p>
        </div>
      ) : (
        <div className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-muted">
          Profile complete — you&apos;re ready to apply to open roles.
        </div>
      )}

      <form action={updateCandidateProfile} className="mt-10 space-y-10">
        <section className="space-y-6">
          <p className={sectionHeading}>Basics</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="full_name" className={labelClass}>
                Full name
              </label>
              <input
                id="full_name"
                name="full_name"
                required
                maxLength={200}
                defaultValue={profile.full_name}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="headline" className={labelClass}>
                Headline
              </label>
              <input
                id="headline"
                name="headline"
                maxLength={200}
                defaultValue={profile.headline ?? ""}
                placeholder="Senior Anaplan Model Builder · 7 yrs"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="country_code" className={labelClass}>
                Country of residence
              </label>
              <select
                id="country_code"
                name="country_code"
                defaultValue={profile.country_code}
                className={inputClass}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
              </select>
            </div>
            <div>
              <label htmlFor="location_label" className={labelClass}>
                City / region
              </label>
              <input
                id="location_label"
                name="location_label"
                maxLength={200}
                defaultValue={profile.location_label ?? ""}
                placeholder="Toronto, ON"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="years_experience_anaplan" className={labelClass}>
                Years of Anaplan experience
              </label>
              <input
                id="years_experience_anaplan"
                name="years_experience_anaplan"
                type="number"
                min={0}
                max={40}
                required
                defaultValue={profile.years_experience_anaplan}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-hairline pt-8">
          <p className={sectionHeading}>Work authorization</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="work_auth_us" className={labelClass}>
                United States
              </label>
              <select
                id="work_auth_us"
                name="work_auth_us"
                defaultValue={profile.work_auth_us}
                className={inputClass}
              >
                <option value="none">Not authorized</option>
                <option value="citizen">Citizen</option>
                <option value="permanent_resident">Permanent resident</option>
                <option value="visa_required">Need sponsorship</option>
              </select>
            </div>
            <div>
              <label htmlFor="work_auth_ca" className={labelClass}>
                Canada
              </label>
              <select
                id="work_auth_ca"
                name="work_auth_ca"
                defaultValue={profile.work_auth_ca}
                className={inputClass}
              >
                <option value="none">Not authorized</option>
                <option value="citizen">Citizen</option>
                <option value="permanent_resident">Permanent resident</option>
                <option value="visa_required">Need sponsorship</option>
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-hairline pt-8">
          <p className={sectionHeading}>Work style</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="open_to_remote"
                defaultChecked={profile.open_to_remote}
                className="h-4 w-4 border-hairline"
              />
              Open to remote
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="open_to_hybrid"
                defaultChecked={profile.open_to_hybrid}
                className="h-4 w-4 border-hairline"
              />
              Open to hybrid
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="open_to_onsite"
                defaultChecked={profile.open_to_onsite}
                className="h-4 w-4 border-hairline"
              />
              Open to on-site
            </label>
          </div>
        </section>

        <section className="space-y-6 border-t border-hairline pt-8">
          <p className={sectionHeading}>Links</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="linkedin_url" className={labelClass}>
                LinkedIn URL
              </label>
              <input
                id="linkedin_url"
                name="linkedin_url"
                type="url"
                maxLength={500}
                defaultValue={profile.linkedin_url ?? ""}
                placeholder="https://www.linkedin.com/in/..."
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="portfolio_url" className={labelClass}>
                Portfolio / website
              </label>
              <input
                id="portfolio_url"
                name="portfolio_url"
                type="url"
                maxLength={500}
                defaultValue={profile.portfolio_url ?? ""}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="space-y-6 border-t border-hairline pt-8">
          <p className={sectionHeading}>Bio (optional)</p>
          <textarea
            name="bio"
            rows={6}
            maxLength={8000}
            defaultValue={profile.bio ?? ""}
            placeholder="A few sentences about your background. Markdown supported."
            className={`${inputClass} font-mono text-xs`}
          />
        </section>

        <div className="border-t border-hairline pt-6">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
          >
            Save profile
          </button>
        </div>
      </form>

      <section className="mt-16 border-t border-hairline pt-8">
        <p className={sectionHeading}>Resume</p>
        <p className="mt-3 text-sm text-foreground">
          PDF only, up to 5 MB. Replacing the file keeps previously submitted
          applications intact — employers always see the resume you submitted
          on the day you applied.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4 border border-hairline bg-surface px-5 py-4">
          <div className="flex-1">
            <p className="text-sm text-foreground">{resumeLabel(profile.resume_path)}</p>
            {profile.resume_uploaded_at ? (
              <p className="mt-1 text-xs text-muted">
                Uploaded {formatPublishedDate(profile.resume_uploaded_at)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">
                Upload a PDF to finish your profile.
              </p>
            )}
          </div>
          {profile.resume_path ? (
            <form action={deleteResume}>
              <button
                type="submit"
                className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
              >
                Remove
              </button>
            </form>
          ) : null}
        </div>
        <form
          action={uploadResume}
          encType="multipart/form-data"
          className="mt-6 flex flex-wrap items-center gap-4"
        >
          <label htmlFor="resume-upload" className="sr-only">
            Resume PDF file
          </label>
          <input
            id="resume-upload"
            type="file"
            name="resume"
            accept="application/pdf"
            required
            className="text-sm"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-5 text-xs font-medium uppercase tracking-[0.12em] text-on-accent transition-colors duration-150 hover:bg-accent-hover"
          >
            {profile.resume_path ? "Replace resume" : "Upload resume"}
          </button>
        </form>
      </section>

      <section className="mt-16 border-t border-hairline pt-8">
        <p className={sectionHeading}>Email preferences</p>
        <p className="mt-3 text-sm text-muted">
          A weekly digest of new Anaplan roles that match your work
          authorization and remote / hybrid / on-site preferences. Off by
          default if you opt out — we won&apos;t email if there are no matches
          either way.
        </p>
        <form
          action={setDigestOptIn}
          className="mt-6 flex flex-wrap items-center gap-4 border border-hairline bg-surface px-5 py-4"
        >
          <label className="flex flex-1 items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="digest_opt_in"
              defaultChecked={profile.digest_opt_in}
              className="mt-1 h-4 w-4 border-hairline"
            />
            <span>
              Send me the weekly profile-match digest
              {profile.digest_last_sent_at ? (
                <span className="mt-1 block text-xs text-muted">
                  Last digest sent{" "}
                  {formatPublishedDate(profile.digest_last_sent_at)}.
                </span>
              ) : (
                <span className="mt-1 block text-xs text-muted">
                  No digests sent yet — first run picks the most recent
                  matching roles.
                </span>
              )}
            </span>
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center border border-transparent bg-foreground px-4 text-xs font-medium uppercase tracking-[0.1em] text-background hover:bg-accent hover:text-on-accent"
          >
            Save preference
          </button>
        </form>
      </section>

      <section className="mt-16 border-t border-hairline pt-8">
        <p className={sectionHeading}>Certifications</p>
        <p className="mt-3 text-sm text-muted">
          Anaplan Certified Model Builder, Solution Architect, etc.
        </p>
        <CredentialList rows={byType.certification} />
        <CredentialForm type="certification" />
      </section>

      <section className="mt-16 border-t border-hairline pt-8">
        <p className={sectionHeading}>Role history</p>
        <p className="mt-3 text-sm text-muted">
          Recent roles relevant to Anaplan — model builder, architect, admin,
          etc.
        </p>
        <CredentialList rows={byType.role_history} />
        <CredentialForm type="role_history" />
      </section>

      <section className="mt-16 border-t border-hairline pt-8">
        <p className={sectionHeading}>Education</p>
        <CredentialList rows={byType.education} />
        <CredentialForm type="education" />
      </section>

      <div className="mt-16 border-t border-hairline pt-8">
        <p className="text-xs uppercase tracking-[0.12em] text-muted">
          Country:{" "}
          <span className="text-foreground">
            {formatCountry(profile.country_code)}
          </span>{" "}
          · US auth:{" "}
          <span className="text-foreground">
            {workAuthLabels[profile.work_auth_us]}
          </span>{" "}
          · CA auth:{" "}
          <span className="text-foreground">
            {workAuthLabels[profile.work_auth_ca]}
          </span>
        </p>
        <p className="mt-4 text-xs text-muted">
          Last updated {formatPublishedDate(profile.updated_at)}. Ready to
          apply?{" "}
          <Link href="/jobs" className="underline underline-offset-2 hover:text-foreground">
            Browse open roles
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function CredentialList({ rows }: { rows: CredentialRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-6 text-xs text-muted">Nothing yet.</p>
    );
  }
  return (
    <ul className="mt-6 divide-y divide-hairline border border-hairline bg-surface">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{row.title}</p>
            {row.organization_name ? (
              <p className="mt-1 text-xs text-muted">{row.organization_name}</p>
            ) : null}
            {(row.start_date || row.end_date) ? (
              <p className="mt-1 text-xs text-muted">
                {formatDateRange(row.start_date, row.end_date)}
              </p>
            ) : null}
            {row.description ? (
              <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                {row.description}
              </p>
            ) : null}
          </div>
          <form action={deleteCredential}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
            >
              Remove
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

function CredentialForm({
  type,
}: {
  type: "certification" | "role_history" | "education";
}) {
  const titleLabel = type === "education" ? "Degree / program" : "Title";
  const orgLabel = type === "education" ? "School" : "Organization";
  const titlePlaceholder =
    type === "certification"
      ? "Anaplan Certified Model Builder"
      : type === "role_history"
        ? "Senior Anaplan Model Builder"
        : "B.Sc. Finance";
  const addLabel =
    type === "certification"
      ? "certification"
      : type === "role_history"
        ? "role"
        : "education";

  return (
    <form action={addCredential} className="mt-6 space-y-4 border border-hairline bg-surface px-5 py-5">
      <input type="hidden" name="credential_type" value={type} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>{titleLabel}</span>
          <input
            name="title"
            required
            maxLength={250}
            className={inputClass}
            placeholder={titlePlaceholder}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{orgLabel}</span>
          <input
            name="organization_name"
            maxLength={250}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Start date</span>
          <input name="start_date" type="date" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>End date (blank = ongoing)</span>
          <input name="end_date" type="date" className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Description (optional)</span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-5 text-xs font-medium uppercase tracking-[0.12em] text-on-accent transition-colors duration-150 hover:bg-accent-hover"
      >
        Add {addLabel}
      </button>
    </form>
  );
}
