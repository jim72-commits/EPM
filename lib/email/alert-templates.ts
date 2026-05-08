import "server-only";

import type { JobListItem } from "@/lib/types/jobs";

import { FOOTER_HTML, FOOTER_TEXT } from "./footer";

type ConfirmArgs = {
  confirmUrl: string;
  description: string;
};

type DigestArgs = {
  jobs: JobListItem[];
  description: string;
  siteUrl: string;
  browseUrl: string;
  unsubscribeUrl: string;
};

type UnsubscribeArgs = {
  email: string;
  description: string;
};

export function alertConfirmEmail(args: ConfirmArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { confirmUrl, description } = args;
  const subject = `Confirm your TheCOE job alert: ${description}`;
  const text = [
    `You'll receive ${description} as new roles go live, weekly.`,
    "",
    "Confirm to start receiving matches:",
    confirmUrl,
    "",
    "If you didn't request this, ignore this email. No emails will be sent",
    "without your confirmation.",
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">Confirm your job alert</h1>
  <p style="margin:0 0 16px;color:#555;">You&rsquo;ll receive <strong>${description}</strong> as new roles go live, weekly.</p>
  <p style="margin:0 0 24px;color:#555;">Click below to start receiving matches. Nothing is sent without this click.</p>
  <p style="margin:0 0 32px;">
    <a href="${confirmUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">Confirm alert</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#888;">Or paste this link into your browser:</p>
  <p style="margin:0 0 32px;font-size:12px;color:#555;word-break:break-all;">${confirmUrl}</p>
  <p style="margin:0 0 4px;font-size:12px;color:#888;">If you didn&rsquo;t request this, ignore this email.</p>
  ${FOOTER_HTML}
</body></html>`;
  return { subject, html, text };
}

export function alertDigestEmail(args: DigestArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { jobs, description, siteUrl, browseUrl, unsubscribeUrl } = args;
  const count = jobs.length;
  const plural = count === 1 ? "role" : "roles";

  const subject = `${count} new Anaplan ${plural} — ${description}`;

  const textLines = [
    `${count} new ${plural} match your TheCOE alert (${description}).`,
    "",
    ...jobs.map(
      (j) =>
        `• ${j.title} — ${j.organization.name} (${j.location_label ?? "—"})\n  ${siteUrl}/jobs/${j.slug}`,
    ),
    "",
    "See the full list with filters applied:",
    browseUrl,
    "",
    "Unsubscribe from this alert:",
    unsubscribeUrl,
    "",
    FOOTER_TEXT,
  ];

  const htmlRows = jobs
    .map(
      (j) => `<li style="margin:0 0 14px;list-style:none;padding:12px 16px;border:1px solid #eee;background:#fafafa;">
  <a href="${siteUrl}/jobs/${j.slug}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${escapeHtml(j.title)}</a>
  <div style="margin-top:4px;font-size:13px;color:#555;">${escapeHtml(j.organization.name)}</div>
  <div style="margin-top:4px;font-size:12px;color:#888;">${escapeHtml(j.location_label ?? "—")} · ${j.remote_policy} · ${j.employment_type.replace("_", " ")}</div>
</li>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;">${count} new ${plural} match your alert</h1>
  <p style="margin:0 0 24px;color:#555;">Criteria: <strong>${escapeHtml(description)}</strong></p>
  <ul style="padding:0;margin:0 0 24px;">${htmlRows}</ul>
  <p style="margin:0 0 24px;">
    <a href="${browseUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">Open the directory</a>
  </p>
  ${FOOTER_HTML}
  <p style="margin:8px 0 0;font-size:12px;color:#888;">
    <a href="${unsubscribeUrl}" style="color:#888;">Unsubscribe from this alert</a>
  </p>
</body></html>`;

  return { subject, html, text: textLines.join("\n") };
}

export function alertUnsubscribedEmail(args: UnsubscribeArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "You're unsubscribed from this TheCOE alert";
  const text = [
    `Your address (${args.email}) was unsubscribed from the job alert:`,
    `  ${args.description}`,
    "",
    "Any other TheCOE alerts or newsletter subscriptions stay active.",
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">You&rsquo;re unsubscribed</h1>
  <p style="margin:0 0 16px;color:#555;">Your address (<strong>${escapeHtml(args.email)}</strong>) was removed from the job alert:</p>
  <p style="margin:0 0 24px;color:#0a0a0a;"><strong>${escapeHtml(args.description)}</strong></p>
  <p style="margin:0 0 24px;color:#555;">Any other TheCOE alerts or newsletter subscriptions stay active.</p>
  ${FOOTER_HTML}
</body></html>`;
  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
