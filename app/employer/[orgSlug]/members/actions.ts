"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { requireOrgMember } from "@/lib/auth/employer";
import { orgInviteEmail } from "@/lib/email/invite-templates";
import {
  isEmailProviderConfigured,
  sendTransactional,
} from "@/lib/email/send";
import { captureException, logEvent } from "@/lib/observability";

const INVITE_TOKEN_BYTES = 32;
const INVITE_TTL_DAYS = 14;

function errorRedirect(orgSlug: string, message: string): never {
  redirect(`/employer/${orgSlug}/members?error=${encodeURIComponent(message)}`);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address."),
  role: z.enum(["owner", "member"]),
});

/**
 * Owner-only action to invite a new teammate to the org.
 *
 * Flow:
 *   1. Generate a cryptographically random token; store only its SHA-256.
 *   2. Insert the invite row (RLS check: invited_by = auth.uid() and the
 *      caller is an owner of this org).
 *   3. Email the recipient with the raw token in the URL.
 *
 * If sending the email fails, we don't roll back the invite — the owner
 * can re-send manually from the members page (a future affordance) and
 * the invite row gives us auditability either way.
 */
export async function inviteTeammate(orgSlug: string, formData: FormData) {
  const { user, supabase, org, role } = await requireOrgMember(orgSlug);

  if (role !== "owner") {
    errorRedirect(orgSlug, "Only owners can invite teammates.");
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "member",
  });

  if (!parsed.success) {
    errorRedirect(
      orgSlug,
      parsed.error.issues[0]?.message ?? "Invalid invite request.",
    );
  }

  const { email, role: requestedRole } = parsed.data;
  const token = crypto.randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: insertData, error: insertError } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: org.id,
      invited_email: email,
      invited_by: user.id,
      role: requestedRole,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      // unique_violation on (organization_id, lower(invited_email)) where
      // pending — friendly message. Owner can revoke first if needed.
      errorRedirect(
        orgSlug,
        "An open invite already exists for that email. Revoke it first to send a new one.",
      );
    }
    captureException(insertError, {
      scope: "employer.invite_teammate",
      org_id: org.id,
    });
    errorRedirect(orgSlug, insertError.message);
  }

  const inviteId = insertData?.id;
  const inviterName =
    user.user_metadata?.full_name?.toString().trim() ||
    user.email?.split("@")[0] ||
    "A teammate";

  // We attach the invited email as a non-secret query param so the
  // accept page can warn when someone forwards the link to the wrong
  // account. The token itself is the security boundary; the param is
  // strictly UX.
  const inviteUrl = `${getAppBaseUrl()}/invite/${token}?for=${encodeURIComponent(email)}`;
  const msg = orgInviteEmail({
    organizationName: org.name,
    inviterName,
    inviteUrl,
    expiresAt,
    role: requestedRole,
  });

  // If no email provider is wired, sendTransactional logs to console and
  // returns delivered: false. We surface that to the owner with the raw
  // invite URL so they can paste it into Slack/SMS — much better than a
  // success toast for an email that never went out.
  let result;
  try {
    result = await sendTransactional({
      to: email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
  } catch (err) {
    captureException(err, {
      scope: "employer.invite_teammate.send",
      org_id: org.id,
    });
    result = { delivered: false, error: "send_threw" } as const;
  }

  logEvent("org_invite_sent", {
    organization_id: org.id,
    invite_id: inviteId ?? null,
    role: requestedRole,
    delivered: result.delivered,
  });

  revalidatePath(`/employer/${orgSlug}/members`);

  // Provider-down path: redirect with the URL embedded so the owner can
  // copy and share manually. We don't expose the URL beyond this single
  // navigation — it's not stored in the DB beyond the hash.
  if (!result.delivered) {
    const params = new URLSearchParams({
      saved: "invited_no_email",
      manual_url: inviteUrl,
      manual_email: email,
      provider_configured: isEmailProviderConfigured() ? "1" : "0",
    });
    redirect(`/employer/${orgSlug}/members?${params.toString()}`);
  }

  redirect(`/employer/${orgSlug}/members?saved=invited`);
}

/**
 * Owner-only resend. Reissues a fresh token for an existing pending
 * invite — we can't recover the old plaintext token (we only stored its
 * hash) so we revoke the previous row and create a new one with a new
 * token, same email + role.
 *
 * The new row inherits the original expiry semantics (now + 14 days) so a
 * stale invite gets a clean re-clock. Audit trail is preserved because we
 * mark the old row revoked rather than deleting.
 */
export async function resendInvite(orgSlug: string, formData: FormData) {
  const { user, supabase, org, role } = await requireOrgMember(orgSlug);
  if (role !== "owner") {
    errorRedirect(orgSlug, "Only owners can resend invites.");
  }

  const inviteId = (formData.get("invite_id") as string) ?? "";
  if (!inviteId) {
    errorRedirect(orgSlug, "Invite not found.");
  }

  const { data: original } = await supabase
    .from("organization_invites")
    .select("id, invited_email, role, accepted_at, revoked_at")
    .eq("id", inviteId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!original) {
    errorRedirect(orgSlug, "Invite not found.");
  }
  if (original.accepted_at != null) {
    errorRedirect(orgSlug, "That invite was already accepted.");
  }
  if (original.revoked_at != null) {
    errorRedirect(orgSlug, "That invite was already revoked.");
  }

  // Revoke the old row first so the unique (organization_id, lower(email))
  // index opens up for the new pending row.
  const { error: revokeError } = await supabase
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq("id", inviteId)
    .eq("organization_id", org.id)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (revokeError) {
    captureException(revokeError, {
      scope: "employer.resend_invite.revoke",
      org_id: org.id,
    });
    errorRedirect(orgSlug, revokeError.message);
  }

  const email = original.invited_email as string;
  const requestedRole = (original.role as "owner" | "member") ?? "member";
  const token = crypto.randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: insertData, error: insertError } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: org.id,
      invited_email: email,
      invited_by: user.id,
      role: requestedRole,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    captureException(insertError, {
      scope: "employer.resend_invite.insert",
      org_id: org.id,
    });
    errorRedirect(orgSlug, insertError.message);
  }

  const inviterName =
    user.user_metadata?.full_name?.toString().trim() ||
    user.email?.split("@")[0] ||
    "A teammate";
  const inviteUrl = `${getAppBaseUrl()}/invite/${token}?for=${encodeURIComponent(email)}`;
  const msg = orgInviteEmail({
    organizationName: org.name,
    inviterName,
    inviteUrl,
    expiresAt,
    role: requestedRole,
  });

  let result;
  try {
    result = await sendTransactional({
      to: email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
  } catch (err) {
    captureException(err, {
      scope: "employer.resend_invite.send",
      org_id: org.id,
    });
    result = { delivered: false, error: "send_threw" } as const;
  }

  logEvent("org_invite_resent", {
    organization_id: org.id,
    old_invite_id: inviteId,
    new_invite_id: insertData?.id ?? null,
    delivered: result.delivered,
  });

  revalidatePath(`/employer/${orgSlug}/members`);

  if (!result.delivered) {
    const params = new URLSearchParams({
      saved: "invited_no_email",
      manual_url: inviteUrl,
      manual_email: email,
      provider_configured: isEmailProviderConfigured() ? "1" : "0",
    });
    redirect(`/employer/${orgSlug}/members?${params.toString()}`);
  }

  redirect(`/employer/${orgSlug}/members?saved=resent`);
}

/**
 * Owner-only revoke. We mark the row revoked rather than delete so the
 * audit trail survives. The unique-pending index will let owners send a
 * fresh invite to the same email afterward.
 */
export async function revokeInvite(orgSlug: string, formData: FormData) {
  const { user, supabase, org, role } = await requireOrgMember(orgSlug);
  if (role !== "owner") {
    errorRedirect(orgSlug, "Only owners can revoke invites.");
  }

  const inviteId = (formData.get("invite_id") as string) ?? "";
  if (!inviteId) {
    errorRedirect(orgSlug, "Invite not found.");
  }

  const { error } = await supabase
    .from("organization_invites")
    .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
    .eq("id", inviteId)
    .eq("organization_id", org.id)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (error) {
    captureException(error, {
      scope: "employer.revoke_invite",
      org_id: org.id,
    });
    errorRedirect(orgSlug, error.message);
  }

  logEvent("org_invite_revoked", {
    organization_id: org.id,
    invite_id: inviteId,
  });

  revalidatePath(`/employer/${orgSlug}/members`);
  redirect(`/employer/${orgSlug}/members?saved=revoked`);
}

/**
 * Owner-only role change for an existing member. We never let an owner
 * demote *themselves* through this action — that's a footgun (last-owner
 * lockout); they have to pick another owner and re-promote.
 */
export async function setMemberRole(orgSlug: string, formData: FormData) {
  const { user, supabase, org, role } = await requireOrgMember(orgSlug);
  if (role !== "owner") {
    errorRedirect(orgSlug, "Only owners can change member roles.");
  }

  const targetUserId = (formData.get("user_id") as string) ?? "";
  const newRole = formData.get("role") === "owner" ? "owner" : "member";

  if (!targetUserId) {
    errorRedirect(orgSlug, "Member not found.");
  }
  if (targetUserId === user.id) {
    errorRedirect(orgSlug, "Pick another owner before demoting yourself.");
  }

  const { error } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("user_id", targetUserId)
    .eq("organization_id", org.id);

  if (error) {
    captureException(error, {
      scope: "employer.set_member_role",
      org_id: org.id,
    });
    errorRedirect(orgSlug, error.message);
  }

  revalidatePath(`/employer/${orgSlug}/members`);
  redirect(`/employer/${orgSlug}/members?saved=role_updated`);
}

/**
 * Owner-only remove. Same self-protection rule: owners can't remove
 * themselves through this path.
 */
export async function removeMember(orgSlug: string, formData: FormData) {
  const { user, supabase, org, role } = await requireOrgMember(orgSlug);
  if (role !== "owner") {
    errorRedirect(orgSlug, "Only owners can remove members.");
  }

  const targetUserId = (formData.get("user_id") as string) ?? "";
  if (!targetUserId) {
    errorRedirect(orgSlug, "Member not found.");
  }
  if (targetUserId === user.id) {
    errorRedirect(orgSlug, "You can't remove yourself. Hand off ownership first.");
  }

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("user_id", targetUserId)
    .eq("organization_id", org.id);

  if (error) {
    captureException(error, { scope: "employer.remove_member", org_id: org.id });
    errorRedirect(orgSlug, error.message);
  }

  logEvent("org_member_removed", {
    organization_id: org.id,
    removed_user_id: targetUserId,
  });

  revalidatePath(`/employer/${orgSlug}/members`);
  redirect(`/employer/${orgSlug}/members?saved=removed`);
}
