import Link from "next/link";
import { notFound } from "next/navigation";

import { RemoveOrgMemberButton } from "@/components/admin/remove-org-member-button";
import { getUsersByIds } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/admin";
import { formatPublishedDate } from "@/lib/format-job";
import { isServiceRoleAvailable } from "@/lib/supabase/service-role";

import { addOrgMember } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const inputClass =
  "mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

export default async function AdminOrgMembersPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : undefined;
  const error =
    typeof sp.error === "string" ? sp.error : undefined;

  const { data: org } = await supabase
    .from("organizations")
    .select("id,name,slug")
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id,role,created_at")
    .eq("organization_id", id)
    .order("created_at", { ascending: true });

  const rows = (members ?? []) as {
    user_id: string;
    role: "owner" | "member";
    created_at: string;
  }[];

  // Resolve UUIDs → emails so admins see who's on the team. Falls back to
  // UUID-only display if the service role isn't configured (e.g., local
  // dev without SUPABASE_SERVICE_ROLE_KEY).
  const usersById = await getUsersByIds(rows.map((r) => r.user_id));
  const canResolveByEmail = isServiceRoleAvailable();

  return (
    <div className="py-6">
      <div className="border-b border-hairline pb-6">
        <Link
          href="/admin/organizations"
          className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
        >
          ← All organizations
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          {org.name} · Members
        </h1>
        <p className="mt-2 text-sm text-muted">
          {canResolveByEmail
            ? "Add users by email — they need an existing TheCOE account first. Members get full access to the employer dashboard for this org; owners can also invite teammates."
            : "Add users to grant them access to the employer dashboard for this organization. The service role isn't configured, so we can't show emails — paste the user's Supabase Auth UID instead (Supabase Studio → Authentication → Users)."}
        </p>
      </div>

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

      <form
        action={addOrgMember}
        className="mt-10 grid gap-4 border border-hairline bg-surface px-5 py-6 sm:grid-cols-[1fr_auto_auto]"
      >
        <input type="hidden" name="organization_id" value={org.id} />
        <div>
          <label htmlFor="identifier" className={labelClass}>
            {canResolveByEmail ? "Email or User UID" : "User UID"}
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            placeholder={
              canResolveByEmail
                ? "name@company.com"
                : "00000000-0000-0000-0000-000000000000"
            }
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="role" className={labelClass}>
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="member"
            className={inputClass}
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.1em] text-on-accent hover:bg-accent-hover"
          >
            Add member
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No members yet.</p>
      ) : (
        <div className="mt-10 overflow-x-auto border border-hairline bg-surface">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs font-medium uppercase tracking-[0.12em] text-muted">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 font-medium text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const lookup = usersById.get(m.user_id);
                const email = lookup?.email ?? null;
                const display = email ?? m.user_id;
                return (
                  <tr key={m.user_id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 align-top">
                      {email ? (
                        <>
                          <div className="text-sm text-foreground">{email}</div>
                          <div className="mt-1 font-mono text-[11px] text-muted">
                            {m.user_id}
                          </div>
                        </>
                      ) : (
                        <div className="font-mono text-xs text-foreground">
                          {m.user_id}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.role}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatPublishedDate(m.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RemoveOrgMemberButton
                        organizationId={org.id}
                        userId={m.user_id}
                        display={display}
                        role={m.role}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function savedMessage(value: string): string {
  switch (value) {
    case "added":
      return "Member added.";
    case "removed":
      return "Member removed.";
    case "role_updated":
      return "Member role updated.";
    default:
      return "Saved.";
  }
}
