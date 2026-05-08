import { requireOrgMember } from "@/lib/auth/employer";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { isServiceRoleAvailable } from "@/lib/supabase/service-role";
import { formatPublishedDate } from "@/lib/format-job";

import {
  inviteTeammate,
  removeMember,
  resendInvite,
  revokeInvite,
  setMemberRole,
} from "./actions";
import { CopyInviteLinkButton } from "./copy-invite-link";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type MemberRow = {
  user_id: string;
  role: "owner" | "member";
  created_at: string;
};

type InviteRow = {
  id: string;
  invited_email: string;
  invited_by: string;
  role: "owner" | "member";
  created_at: string;
  expires_at: string;
};

type EmailLookup = Map<string, string>;

const sectionHeading =
  "text-xs font-medium uppercase tracking-[0.14em] text-muted";

async function lookupEmails(userIds: string[]): Promise<EmailLookup> {
  const out: EmailLookup = new Map();
  if (userIds.length === 0 || !isServiceRoleAvailable()) return out;

  const svc = createServiceRoleSupabaseClient();

  // No public way to bulk-fetch emails by id list; we hit the admin API
  // per user. Members lists are small (single-digit to low-double-digit
  // counts) so this is fine.
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data } = await svc.auth.admin.getUserById(id);
        if (data?.user?.email) out.set(id, data.user.email);
      } catch {
        // Best-effort; if this fails we'll fall back to showing user_id.
      }
    }),
  );

  return out;
}

export default async function EmployerMembers({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error =
    typeof sp.error === "string" ? sp.error : null;

  const manualUrl = typeof sp.manual_url === "string" ? sp.manual_url : null;
  const manualEmail =
    typeof sp.manual_email === "string" ? sp.manual_email : null;
  const providerConfigured = sp.provider_configured === "1";

  const { user, supabase, org, role } = await requireOrgMember(orgSlug);
  const isOwner = role === "owner";

  const { data: membersData } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true });

  const members = (membersData ?? []) as MemberRow[];

  const { data: invitesData } = await supabase
    .from("organization_invites")
    .select(
      "id, invited_email, invited_by, role, created_at, expires_at",
    )
    .eq("organization_id", org.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const pendingInvites = (invitesData ?? []) as InviteRow[];

  const userIdsToLookup = new Set<string>();
  members.forEach((m) => userIdsToLookup.add(m.user_id));
  pendingInvites.forEach((i) => userIdsToLookup.add(i.invited_by));
  const emailLookup = await lookupEmails([...userIdsToLookup]);

  const invite = inviteTeammate.bind(null, orgSlug);
  const revoke = revokeInvite.bind(null, orgSlug);
  const resend = resendInvite.bind(null, orgSlug);
  const setRole = setMemberRole.bind(null, orgSlug);
  const remove = removeMember.bind(null, orgSlug);

  const ownerCount = members.filter((m) => m.role === "owner").length;

  return (
    <div className="py-6">
      <div className="border-b border-hairline pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Team
        </h1>
        <p className="mt-2 text-sm text-muted">
          Invite teammates to manage jobs and applicants. Owners can invite
          and remove members; members keep full access to the work but
          can&apos;t change the team list.
        </p>
      </div>

      {saved === "invited" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Invite sent. The link expires in 14 days.
        </p>
      ) : null}
      {saved === "resent" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Invite resent with a fresh link. Old link no longer works.
        </p>
      ) : null}
      {saved === "invited_no_email" && manualUrl ? (
        <div className="mt-6 border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-medium">
            Invite created — but the email didn&apos;t go out.
          </p>
          <p className="mt-1 text-amber-800">
            {providerConfigured
              ? "Our email provider returned an error. Send this link to "
              : "Email delivery isn't configured yet. Send this link to "}
            <strong>{manualEmail}</strong> manually. It expires in 14 days and
            is single-use.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 break-all rounded border border-amber-300 bg-white px-3 py-2 font-mono text-xs text-amber-900">
              {manualUrl}
            </p>
            <CopyInviteLinkButton url={manualUrl} />
          </div>
        </div>
      ) : null}
      {saved === "revoked" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Invite revoked.
        </p>
      ) : null}
      {saved === "removed" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Member removed.
        </p>
      ) : null}
      {saved === "role_updated" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Role updated.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <section className="mt-10">
        <p className={sectionHeading}>Members</p>
        <ul className="mt-4 divide-y divide-hairline border border-hairline bg-surface">
          {members.length === 0 ? (
            <li className="px-5 py-5 text-sm text-muted">No members yet.</li>
          ) : null}
          {members.map((m) => {
            const email = emailLookup.get(m.user_id) ?? m.user_id;
            const isSelf = m.user_id === user.id;
            const isLastOwner = m.role === "owner" && ownerCount <= 1;
            return (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {email}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-muted">(you)</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {m.role === "owner" ? "Owner" : "Member"} · added{" "}
                    {formatPublishedDate(m.created_at)}
                  </p>
                </div>
                {isOwner && !isSelf ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setRole}>
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <input
                        type="hidden"
                        name="role"
                        value={m.role === "owner" ? "member" : "owner"}
                      />
                      <button
                        type="submit"
                        disabled={isLastOwner && m.role === "owner"}
                        className="border border-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground disabled:opacity-40"
                      >
                        {m.role === "owner" ? "Demote to member" : "Promote to owner"}
                      </button>
                    </form>
                    <form action={remove}>
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button
                        type="submit"
                        disabled={isLastOwner}
                        className="border border-red-300 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <p className={sectionHeading}>Pending invites</p>
        <ul className="mt-4 divide-y divide-hairline border border-hairline bg-surface">
          {pendingInvites.length === 0 ? (
            <li className="px-5 py-5 text-sm text-muted">No pending invites.</li>
          ) : null}
          {pendingInvites.map((i) => {
            const inviterEmail = emailLookup.get(i.invited_by) ?? "—";
            return (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{i.invited_email}</p>
                  <p className="mt-1 text-xs text-muted">
                    {i.role === "owner" ? "Owner" : "Member"} · invited by{" "}
                    {inviterEmail} on {formatPublishedDate(i.created_at)} ·
                    expires {formatPublishedDate(i.expires_at)}
                  </p>
                </div>
                {isOwner ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={resend}>
                      <input type="hidden" name="invite_id" value={i.id} />
                      <button
                        type="submit"
                        className="border border-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
                        title="Send a fresh link. The old link stops working."
                      >
                        Resend
                      </button>
                    </form>
                    <form action={revoke}>
                      <input type="hidden" name="invite_id" value={i.id} />
                      <button
                        type="submit"
                        className="border border-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
                      >
                        Revoke
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner ? (
        <section className="mt-10 max-w-2xl border border-hairline bg-surface p-6">
          <h2 className={sectionHeading}>Invite a teammate</h2>
          <p className="mt-2 text-sm text-muted">
            They&apos;ll get an email with a one-time link. New users can sign
            up from the same flow.
          </p>
          <form action={invite} className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Email address
              </span>
              <input
                name="email"
                type="email"
                required
                className="mt-2 w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                Role
              </span>
              <select
                name="role"
                defaultValue="member"
                className="mt-2 w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <div className="self-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.1em] text-on-accent hover:bg-accent-hover"
              >
                Send invite
              </button>
            </div>
          </form>
        </section>
      ) : (
        <p className="mt-10 text-sm text-muted">
          Only owners can invite or remove teammates. Ask an owner to make
          changes.
        </p>
      )}
    </div>
  );
}
