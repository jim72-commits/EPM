import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireOrgMember } from "@/lib/auth/employer";

import { closeJobWithOutcome } from "./actions";
import { CloseListingForm } from "./close-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
};

type ApplicantOption = {
  id: string;
  status: string;
  full_name: string;
  headline: string | null;
};

const VALID_OUTCOMES = new Set([
  "hired_here",
  "hired_elsewhere",
  "not_hired_no_fit",
  "not_hired_cancelled",
]);

function readStr(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

export default async function CloseJobPage({ params, searchParams }: PageProps) {
  const { orgSlug, id: jobId } = await params;
  const sp = await searchParams;
  const errorMsg = typeof sp.error === "string" ? sp.error : null;
  // Round-trip on validation/db error: keep what the employer typed so they
  // don't have to re-write a 4,000-character feedback note.
  const fOutcomeRaw = readStr(sp, "f_outcome");
  const fOutcome = fOutcomeRaw && VALID_OUTCOMES.has(fOutcomeRaw)
    ? (fOutcomeRaw as
        | "hired_here"
        | "hired_elsewhere"
        | "not_hired_no_fit"
        | "not_hired_cancelled")
    : null;
  const fHiredAppId = readStr(sp, "f_hired_application_id") ?? "";
  const fFeedback = readStr(sp, "f_feedback") ?? "";

  const { supabase, org } = await requireOrgMember(orgSlug);

  const { data: job } = await supabase
    .from("jobs")
    .select("id, slug, title, status, listing_kind, organization_id")
    .eq("id", jobId)
    .maybeSingle();

  if (!job || job.organization_id !== org.id) notFound();
  if (job.listing_kind !== "employer") {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "Only listings you posted on TheCOE can be closed here.",
      )}`,
    );
  }
  if (job.status === "filled") {
    redirect(
      `/employer/${orgSlug}/jobs?error=${encodeURIComponent(
        "This listing is already closed.",
      )}`,
    );
  }

  // Pull every non-withdrawn application for this listing. Employers can
  // attribute a hire to any one of them — including someone they marked
  // 'rejected' earlier and then circled back to.
  const { data: appRows } = await supabase
    .from("job_applications")
    .select("id, status, profile_snapshot")
    .eq("job_id", jobId)
    .neq("status", "withdrawn")
    .order("applied_at", { ascending: false });

  const applicants: ApplicantOption[] = (appRows ?? []).map((row) => {
    const snap = (row.profile_snapshot ?? {}) as {
      full_name?: string;
      headline?: string | null;
    };
    return {
      id: row.id as string,
      status: row.status as string,
      full_name:
        typeof snap.full_name === "string" && snap.full_name
          ? snap.full_name
          : "Candidate",
      headline:
        typeof snap.headline === "string" && snap.headline
          ? snap.headline
          : null,
    };
  });

  const action = closeJobWithOutcome.bind(null, orgSlug, jobId);

  return (
    <div className="py-6">
      <Link
        href={`/employer/${orgSlug}/jobs/${jobId}/applicants`}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        ← Applicants · {job.title}
      </Link>

      <header className="mt-4 border-b border-hairline pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Close listing — {job.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Tell us how this role ended. We use this to track how often TheCOE
          actually delivers a hire — for both sides of the marketplace.
          Closing the listing also tells the remaining applicants where they
          stand.
        </p>
      </header>

      {errorMsg ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      <CloseListingForm
        action={action}
        applicants={applicants}
        cancelHref={`/employer/${orgSlug}/jobs/${jobId}/applicants`}
        defaultOutcome={fOutcome}
        defaultHiredAppId={fHiredAppId}
        defaultFeedback={fFeedback}
      />
    </div>
  );
}
