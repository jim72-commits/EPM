import "server-only";

import type { JobListItem } from "@/lib/types/jobs";

import { FOOTER_HTML, FOOTER_TEXT } from "./footer";

type DigestArgs = {
  /** Candidate-facing greeting name (the part before any space/comma). */
  greeting: string;
  jobs: JobListItem[];
  /** App base URL — used to build /jobs and /me links and per-job links. */
  baseUrl: string;
  /** Direct-link to /me/profile?digest_optout — short copy, single click. */
  optOutUrl: string;
};

/**
 * Weekly "new roles for you" digest, addressed to a specific candidate's
 * profile. This is *different* from the alerts digest (filter-driven and
 * unsigned-anonymous). Tone is conversational and explicit about why each
 * role landed here ("matches your remote/hybrid pref + US work auth").
 */
export function profileDigestEmail(args: DigestArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { greeting, jobs, baseUrl, optOutUrl } = args;
  const count = jobs.length;
  const plural = count === 1 ? "role" : "roles";
  const subject = `${count} Anaplan ${plural} that fit your profile`;

  const browseUrl = `${baseUrl}/jobs`;

  const textLines = [
    `Hi ${greeting},`,
    "",
    `${count} new Anaplan ${plural} matching your profile this week:`,
    "",
    ...jobs.map(
      (j) =>
        `• ${j.title} — ${j.organization.name}${j.location_label ? ` (${j.location_label})` : ""}\n  ${baseUrl}/jobs/${j.slug}`,
    ),
    "",
    "See the full list:",
    browseUrl,
    "",
    "Don't want these? Turn off the weekly digest in your profile:",
    optOutUrl,
    "",
    FOOTER_TEXT,
  ];

  const htmlRows = jobs
    .map((j) => {
      const meta = [
        j.location_label,
        j.remote_policy,
        j.employment_type.replace("_", " "),
      ]
        .filter(Boolean)
        .join(" · ");
      return `<li style="margin:0 0 14px;list-style:none;padding:12px 16px;border:1px solid #eee;background:#fafafa;">
  <a href="${baseUrl}/jobs/${j.slug}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${escapeHtml(j.title)}</a>
  ${j.is_featured ? `<span style="margin-left:6px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#a16207;">Featured</span>` : ""}
  <div style="margin-top:4px;font-size:13px;color:#555;">${escapeHtml(j.organization.name)}</div>
  <div style="margin-top:4px;font-size:12px;color:#888;">${escapeHtml(meta)}</div>
</li>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;">Hi ${escapeHtml(greeting)},</h1>
  <p style="margin:0 0 24px;color:#555;">${count} new Anaplan ${plural} matched your profile this week.</p>
  <ul style="padding:0;margin:0 0 24px;">${htmlRows}</ul>
  <p style="margin:0 0 24px;">
    <a href="${browseUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">Open the directory</a>
  </p>
  ${FOOTER_HTML}
  <p style="margin:8px 0 0;font-size:12px;color:#888;">
    <a href="${optOutUrl}" style="color:#888;">Turn off the weekly digest</a>
  </p>
</body></html>`;

  return { subject, html, text: textLines.join("\n") };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
