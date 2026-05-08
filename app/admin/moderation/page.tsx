import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { formatPublishedDate } from "@/lib/format-job";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Row = {
  id: string;
  slug: string;
  title: string;
  created_at: string;
  country_code: "US" | "CA";
  remote_policy: "remote" | "hybrid" | "onsite" | "flexible";
  employment_type: "full_time" | "part_time" | "contract";
  organizations: { name: string; slug: string } | { name: string; slug: string }[] | null;
  platforms: { name: string } | { name: string }[] | null;
  role_families: { name: string } | { name: string }[] | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function AdminModerationPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const approved = typeof sp.approved === "string" ? sp.approved : null;
  const rejected = typeof sp.rejected === "string" ? sp.rejected : null;

  const { supabase } = await requireAdmin();

  const { data, error: qError } = await supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        created_at,
        country_code,
        remote_policy,
        employment_type,
        organizations ( name, slug ),
        platforms ( name ),
        role_families ( name )
      `,
    )
    .eq("status", "pending_review")
    .eq("listing_kind", "employer")
    .order("created_at", { ascending: true });

  const rows = qError ? [] : ((data ?? []) as Row[]);

  return (
    <div className="py-6">
      <div className="border-b border-hairline pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Moderation queue
        </h1>
        <p className="mt-2 text-sm text-muted">
          Review listings submitted by employers. Approve to publish; reject
          with a note if changes are needed.
        </p>
      </div>

      {approved ? (
        <p className="mt-6 border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Approved &ldquo;{approved}&rdquo;. The listing is now live on the public board.
        </p>
      ) : null}
      {rejected ? (
        <p className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Rejected &ldquo;{rejected}&rdquo;. The employer will see your note next
          time they edit the listing.
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
        <p className="mt-10 text-sm text-muted">
          Queue is empty. New submissions will appear here.
        </p>
      ) : null}

      {!qError && rows.length > 0 ? (
        <div className="mt-10 overflow-x-auto border border-hairline bg-surface">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 font-medium">Listing</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Platform / Role</th>
                <th className="px-4 py-3 font-medium">Setup</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => {
                const org = first(job.organizations);
                const platform = first(job.platforms);
                const roleFamily = first(job.role_families);
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
                    </td>
                    <td className="px-4 py-3 text-muted">{org?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      <div>{platform?.name ?? "—"}</div>
                      <div className="text-xs">{roleFamily?.name ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      <div>
                        {job.country_code} · {job.remote_policy}
                      </div>
                      <div>{job.employment_type.replace("_", " ")}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatPublishedDate(job.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/moderation/${job.id}`}
                        className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
