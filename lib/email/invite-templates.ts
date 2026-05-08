import "server-only";

import { FOOTER_HTML, FOOTER_TEXT } from "./footer";

type OrgInviteArgs = {
  organizationName: string;
  inviterName: string | null;
  inviteUrl: string;
  expiresAt: string;
  role: "owner" | "member";
};

/**
 * Owner-driven team invitation email. Body intentionally short — the
 * recipient should know who invited them, where they're being invited to,
 * and have a single CTA.
 */
export function orgInviteEmail(args: OrgInviteArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { organizationName, inviterName, inviteUrl, expiresAt, role } = args;
  const inviter = inviterName?.trim() || "A teammate";
  const expiresLabel = formatExpiry(expiresAt);
  const subject = `${inviter} invited you to ${organizationName} on TheCOE`;
  const roleCopy =
    role === "owner"
      ? "as an owner — full control over jobs, applicants, and team members"
      : "as a member — you'll be able to manage jobs and applicants";

  const text = [
    `${inviter} invited you to ${organizationName} on TheCOE ${roleCopy}.`,
    "",
    "Accept the invite (you'll sign in or sign up first):",
    inviteUrl,
    "",
    `Expires ${expiresLabel}.`,
    "",
    FOOTER_TEXT,
  ].join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">You're invited to ${escapeHtml(organizationName)}</h1>
  <p style="margin:0 0 16px;color:#555;">${escapeHtml(inviter)} invited you to ${escapeHtml(organizationName)} on TheCOE ${escapeHtml(roleCopy)}.</p>
  <p style="margin:0 0 32px;">
    <a href="${inviteUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">Accept invite</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#888;">Or paste this link:</p>
  <p style="margin:0 0 16px;font-size:12px;color:#555;word-break:break-all;">${inviteUrl}</p>
  <p style="margin:0 0 32px;font-size:12px;color:#888;">Link expires ${escapeHtml(expiresLabel)}.</p>
  ${FOOTER_HTML}
</body></html>`;

  return { subject, html, text };
}

function formatExpiry(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const date = new Date(ms);
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
