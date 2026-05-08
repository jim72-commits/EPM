import Link from "next/link";

import { requireOrgMember } from "@/lib/auth/employer";
import { formatPublishedDate } from "@/lib/format-job";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";

import {
  deleteEmployerDraft,
  setEmployerJobStatus,
  submitJobForReview,
} from "./actions";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Row = {
  id: string;
  slug: string;
  title: string;
  status:
    | "draft"
    | "pending_review"
    | "open"
    | "filled"
    | "unpublished"
    | "rejected";
  listing_kind: "employer" | "syndicated";
  created_at: string;
  published_at: string | null;
  moderation_note: string | null;
  platforms: { name: string } | { name: string }[] | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const statusLabels: Record<Row["status"], string> = {
  draft: "Draft",
  pending_review: "In review",
  open: "Live",
  filled: "Filled",
  unpublished: "Unpublished",
  rejected: "Needs changes",
};

export default async function EmployerJobsPage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug } = await params;
  const { supabase, org } = await requireOrgMember(orgSlug);
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const closed = sp.closed === "1";
  const paused = sp.paused === "1";
  const welcome = typeof sp.welcome === "string" ? sp.welcome : null;
  const error =
    typeof sp.error === "string" ? sp.error : undefined;

  const { data, error: qError } = await supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        status,
        listing_kind,
        created_at,
        published_at,
        moderation_note,
        platforms ( name )
      `,
    )
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  const rows = qError ? [] : ((data ?? []) as Row[]);

  // Aggregate applicant counts per job in a single round-trip. "Active" here
  // excludes withdrawn/rejected/hired so the badge reflects pending work.
  const jobIds = rows.map((r) => r.id);
  const applicantCounts = new Map<string, { total: number; active: number }>();
  if (jobIds.length > 0) {
    const { data: appRows } = await supabase
      .from("job_applications")
      .select("job_id, status")
      .in("job_id", jobIds);
    for (const a of appRows ?? []) {
      const jobId = (a as { job_id: string }).job_id;
      const status = (a as { status: string }).status;
      const entry = applicantCounts.get(jobId) ?? { total: 0, active: 0 };
      entry.total += 1;
      if (["submitted", "under_review", "shortlisted"].includes(status)) {
        entry.active += 1;
      }
      applicantCounts.set(jobId, entry);
    }
  }

  const deleteDraft = deleteEmployerDraft.bind(null, orgSlug);
  const setStatus = setEmployerJobStatus.bind(null, orgSlug);
  const submitForReview = submitJobForReview.bind(null, orgSlug);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Jobs
          </h1>
          <p className="mt-2 text-sm text-muted">
            Drafts, live listings, and recently closed roles.
          </p>
        </div>
        <Link
          href={`/employer/${orgSlug}/jobs/new`}
          className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.1em] text-on-accent hover:bg-accent-hover"
        >
          New draft
        </Link>
      </div>

      {welcome === "verified" ? (
        <div className="mt-6 border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
          <p className="font-medium">You&apos;re in.</p>
          <p className="mt-1 text-green-800">
            Your email is verified and your workspace at{" "}
            <code className="font-mono text-xs text-green-900">/employer/{orgSlug}</code>{" "}
            is live. Spin up your first listing whenever you&apos;re ready.
          </p>
        </div>
      ) : null}
      {welcome === "invite" ? (
        <div className="mt-6 border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
          <p className="font-medium">Welcome to the {org.name} team.</p>
          <p className="mt-1 text-green-800">
            You can manage drafts, publish listings, and review applicants
            with the rest of your team from here.
          </p>
        </div>
      ) : null}
      {saved ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Saved.
        </p>
      ) : null}
      {closed ? (
        <p className="mt-6 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Listing closed. Outcome recorded — thanks for telling us how it
          ended.
        </p>
      ) : null}
      {paused ? (
        <p className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Listing paused. It&apos;s off the public board — existing applicants
          can still hear back from you, and you can republish anytime.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {qError ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {qError.message}
        </p>
      ) : null}

      {!qError && rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No jobs yet.</p>
      ) : null}
      {!qError && rows.length > 0 ? (
        <div className="mt-10 overflow-x-auto border border-hairline bg-surface">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Applicants</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => {
                const pl = first(job.platforms);
                // Live listings shouldn't be edited in place. Pending-review
                // listings shouldn't be edited either — once submitted, the
                // employer waits for the moderator's decision.
                const canEdit =
                  job.status !== "open" && job.status !== "pending_review";
                const apps = applicantCounts.get(job.id);
                return (
                  <tr
                    key={job.id}
                    className="border-b border-hairline last:border-0 align-top"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {job.title}
                      </div>
                      <div className="text-xs text-muted">/{job.slug}</div>
                      {job.status === "rejected" && job.moderation_note ? (
                        <p
                          className="mt-1 text-xs leading-relaxed text-amber-700"
                          title={job.moderation_note}
                        >
                          Moderator: {job.moderation_note}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{pl?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {statusLabels[job.status]}
                    </td>
                    <td className="px-4 py-3 text-muted tabular-nums">
                      {apps
                        ? `${apps.active} active · ${apps.total} total`
                        : "0"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatPublishedDate(job.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-3">
                        {/* Drafts and pending-review listings have no
                            applicants by definition; only show the link once
                            the listing has been publishable. */}
                        {job.listing_kind === "employer" &&
                        job.status !== "draft" &&
                        job.status !== "pending_review" &&
                        job.status !== "rejected" ? (
                          <Link
                            href={`/employer/${orgSlug}/jobs/${job.id}/applicants`}
                            className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                          >
                            Applicants
                          </Link>
                        ) : null}
                        {canEdit ? (
                          <Link
                            href={`/employer/${orgSlug}/jobs/${job.id}/edit`}
                            className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                          >
                            Edit
                          </Link>
                        ) : null}
                        {job.status === "open" ? (
                          <>
                            <form action={setStatus}>
                              <input type="hidden" name="id" value={job.id} />
                              <input
                                type="hidden"
                                name="status"
                                value="unpublished"
                              />
                              <input type="hidden" name="redirect" value="paused" />
                              <button
                                type="submit"
                                className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
                                title="Pull off the public board without closing it"
                              >
                                Pause
                              </button>
                            </form>
                            <Link
                              href={`/employer/${orgSlug}/jobs/${job.id}/close`}
                              className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
                            >
                              Close listing
                            </Link>
                          </>
                        ) : null}
                        {job.status === "draft" ||
                        job.status === "unpublished" ||
                        job.status === "rejected" ? (
                          <form action={submitForReview}>
                            <input type="hidden" name="id" value={job.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                              title="Send this listing to the moderation queue"
                            >
                              {job.status === "rejected"
                                ? "Resubmit"
                                : job.status === "unpublished"
                                  ? "Resubmit"
                                  : "Submit for review"}
                            </button>
                          </form>
                        ) : null}
                        {job.status === "pending_review" ? (
                          <form action={setStatus}>
                            <input type="hidden" name="id" value={job.id} />
                            <input
                              type="hidden"
                              name="status"
                              value="draft"
                            />
                            <button
                              type="submit"
                              className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
                              title="Pull this listing out of the moderation queue"
                            >
                              Withdraw
                            </button>
                          </form>
                        ) : null}
                        {job.status === "draft" ? (
                          <form action={deleteDraft}>
                            <input type="hidden" name="id" value={job.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
                            >
                              Delete
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-10 text-xs leading-relaxed text-muted">
        Need changes to a live listing? Email{" "}
        <a
          href={SUPPORT_MAILTO}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
