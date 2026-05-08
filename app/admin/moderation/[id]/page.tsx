import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";

import { requireAdmin } from "@/lib/auth/admin";
import { formatPublishedDate } from "@/lib/format-job";

import { approveJob, rejectJob } from "../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Job = {
  id: string;
  slug: string;
  title: string;
  status: string;
  listing_kind: "employer" | "syndicated";
  country_code: "US" | "CA";
  location_label: string | null;
  remote_policy: "remote" | "hybrid" | "onsite" | "flexible";
  employment_type: "full_time" | "part_time" | "contract";
  summary: string | null;
  full_description: string | null;
  created_at: string;
  organization_id: string;
  organizations:
    | { name: string; slug: string }
    | { name: string; slug: string }[]
    | null;
  platforms: { name: string } | { name: string }[] | null;
  role_families: { name: string } | { name: string }[] | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AdminModerationDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        status,
        listing_kind,
        country_code,
        location_label,
        remote_policy,
        employment_type,
        summary,
        full_description,
        created_at,
        organization_id,
        organizations ( name, slug ),
        platforms ( name ),
        role_families ( name )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const job = data as Job;

  if (job.status !== "pending_review") {
    return (
      <div className="py-6">
        <Link
          href="/admin/moderation"
          className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
        >
          ← Back to queue
        </Link>
        <div className="mt-6 border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">Listing isn&apos;t in review.</p>
          <p className="mt-1">
            Current status: <code>{job.status}</code>. Someone may have already
            decided on this listing — refresh the queue to see the latest.
          </p>
        </div>
      </div>
    );
  }

  const org = first(job.organizations);
  const platform = first(job.platforms);
  const roleFamily = first(job.role_families);

  return (
    <div className="py-6">
      <Link
        href="/admin/moderation"
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        ← Back to queue
      </Link>

      <div className="mt-6 border-b border-hairline pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Submitted {formatPublishedDate(job.created_at)} · {org?.name ?? "—"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          {job.title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          /{job.slug}
        </p>
      </div>

      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <article>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 border border-hairline bg-surface px-5 py-4 text-sm">
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Platform
            </dt>
            <dd className="text-foreground">{platform?.name ?? "—"}</dd>
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Role family
            </dt>
            <dd className="text-foreground">{roleFamily?.name ?? "—"}</dd>
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Country
            </dt>
            <dd className="text-foreground">{job.country_code}</dd>
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Location
            </dt>
            <dd className="text-foreground">{job.location_label ?? "—"}</dd>
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Remote policy
            </dt>
            <dd className="text-foreground">{job.remote_policy}</dd>
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Employment type
            </dt>
            <dd className="text-foreground">
              {job.employment_type.replace("_", " ")}
            </dd>
          </dl>

          {job.summary ? (
            <section className="mt-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Summary
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {job.summary}
              </p>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Full description
            </h2>
            <div className="mt-2 prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>
                {job.full_description ?? "_(no description)_"}
              </ReactMarkdown>
            </div>
          </section>
        </article>

        <aside className="space-y-6">
          <form
            action={approveJob}
            className="border border-hairline bg-surface px-5 py-5"
          >
            <input type="hidden" name="id" value={job.id} />
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Approve listing
            </p>
            <p className="mt-2 text-sm text-muted">
              Publishes immediately and stamps the listing live on the public
              board. The employer will see &ldquo;Live&rdquo; on their dashboard.
            </p>
            <button
              type="submit"
              className="mt-4 inline-flex h-11 w-full items-center justify-center border border-transparent bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
            >
              Approve and publish
            </button>
          </form>

          <form
            action={rejectJob}
            className="border border-hairline bg-surface px-5 py-5"
          >
            <input type="hidden" name="id" value={job.id} />
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Reject with feedback
            </p>
            <label
              htmlFor="moderation-note"
              className="mt-3 block text-xs font-medium text-muted"
            >
              What needs to change?
            </label>
            <textarea
              id="moderation-note"
              name="note"
              rows={5}
              required
              maxLength={2000}
              placeholder="e.g., The role description is too generic. Add specifics about Anaplan modeling experience required and the team structure."
              className="mt-1 w-full border border-hairline bg-page px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
            <p className="mt-1 text-xs text-muted">
              The employer sees this note when they reopen the listing.
            </p>
            <button
              type="submit"
              className="mt-4 inline-flex h-11 w-full items-center justify-center border border-amber-300 bg-amber-50 px-4 text-sm font-medium text-amber-900 transition-colors duration-150 hover:bg-amber-100"
            >
              Reject and send note
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
