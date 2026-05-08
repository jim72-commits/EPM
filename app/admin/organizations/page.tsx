import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { formatPublishedDate } from "@/lib/format-job";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminOrganizationsPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : undefined;
  const queryError =
    typeof sp.error === "string" ? sp.error : undefined;

  const { data, error: loadError } = await supabase
    .from("organizations")
    .select("id,name,slug,organization_type,country_code,created_at")
    .order("name");

  if (loadError) {
    console.error(loadError);
    return (
      <p className="py-10 text-sm text-muted">Could not load organizations.</p>
    );
  }

  const rows = data ?? [];

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Organizations
          </h1>
          <p className="mt-2 text-sm text-muted">
            Employers and agencies that own job postings.
          </p>
        </div>
        <Link
          href="/admin/organizations/new"
          className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.1em] text-on-accent hover:bg-accent-hover"
        >
          New organization
        </Link>
      </div>

      {saved ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          {savedMessage(saved)}
        </p>
      ) : null}
      {queryError ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {queryError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No organizations yet.</p>
      ) : (
        <div className="mt-10 overflow-x-auto border border-hairline bg-surface">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{o.name}</td>
                  <td className="px-4 py-3 text-muted">{o.slug}</td>
                  <td className="px-4 py-3 text-muted">{o.organization_type}</td>
                  <td className="px-4 py-3 text-muted">{o.country_code}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatPublishedDate(o.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/organizations/${o.id}/edit`}
                        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/admin/organizations/${o.id}/members`}
                        className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
                      >
                        Members
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function savedMessage(value: string): string {
  switch (value) {
    case "created":
      return "Organization created.";
    case "updated":
      return "Organization updated.";
    default:
      return "Saved.";
  }
}
