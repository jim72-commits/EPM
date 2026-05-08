import Link from "next/link";

import { requireEmployer } from "@/lib/auth/employer";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  not_a_member: "You aren't a member of that organization.",
  not_found: "We couldn't find that organization.",
};

export default async function EmployerHome({ searchParams }: PageProps) {
  const { user, supabase } = await requireEmployer();
  const sp = await searchParams;
  const errorKey = typeof sp.error === "string" ? sp.error : undefined;

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations ( id, name, slug )")
    .eq("user_id", user.id);

  const orgs =
    memberships?.map((row) => {
      const org = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      return org
        ? {
            role: row.role as "owner" | "member",
            id: org.id as string,
            name: org.name as string,
            slug: org.slug as string,
          }
        : null;
    }) ?? [];

  const visible = orgs.filter((o): o is NonNullable<typeof o> => o !== null);

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your organizations
          </h1>
          <p className="mt-2 text-sm text-muted">
            Select an organization to manage job drafts.
          </p>
        </div>
      </div>

      {errorKey && errorMessages[errorKey] ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {errorMessages[errorKey]}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          You aren&apos;t a member of any organization yet. Ask the organization
          owner who invited you to send a fresh invite link.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-hairline border border-hairline bg-surface">
          {visible.map((org) => (
            <li key={org.id}>
              <Link
                href={`/employer/${org.slug}/jobs`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-page"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {org.name}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                    {org.role}
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-accent">
                  Manage jobs →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
