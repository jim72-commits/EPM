import "server-only";

import { FOOTER_HTML, FOOTER_TEXT } from "./footer";

type ApplicationReceivedArgs = {
  candidateName: string;
  jobTitle: string;
  organizationName: string;
  applicationUrl: string;
};

type NewApplicantArgs = {
  jobTitle: string;
  organizationName: string;
  candidateName: string;
  candidateHeadline: string | null;
  applicantsUrl: string;
};

export function applicationReceivedEmail(args: ApplicationReceivedArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { candidateName, jobTitle, organizationName, applicationUrl } = args;
  const subject = `Application received: ${jobTitle}`;
  const text = [
    `Hi ${candidateName},`,
    "",
    `Your application for ${jobTitle} at ${organizationName} is in. The hiring team will review it and get back through TheCOE.`,
    "",
    `Track status here:`,
    applicationUrl,
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">Application received</h1>
  <p style="margin:0 0 16px;color:#555;">Hi ${candidateName},</p>
  <p style="margin:0 0 16px;color:#555;">Your application for <strong>${jobTitle}</strong> at <strong>${organizationName}</strong> is in. The hiring team will review it and get back through TheCOE.</p>
  <p style="margin:0 0 32px;">
    <a href="${applicationUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">Track status</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#888;">Or paste this link:</p>
  <p style="margin:0 0 32px;font-size:12px;color:#555;word-break:break-all;">${applicationUrl}</p>
  ${FOOTER_HTML}
</body></html>`;
  return { subject, html, text };
}

export function newApplicantEmail(args: NewApplicantArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { jobTitle, organizationName, candidateName, candidateHeadline, applicantsUrl } =
    args;
  const subject = `New applicant for ${jobTitle}`;
  const text = [
    `Hi ${organizationName} team,`,
    "",
    `A new candidate just applied to ${jobTitle}:`,
    `  ${candidateName}${candidateHeadline ? ` — ${candidateHeadline}` : ""}`,
    "",
    "Review the full application:",
    applicantsUrl,
    "",
    FOOTER_TEXT,
  ].join("\n");
  const headline = candidateHeadline
    ? `<span style="color:#888;"> — ${candidateHeadline}</span>`
    : "";
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">New applicant</h1>
  <p style="margin:0 0 16px;color:#555;">A new candidate just applied to <strong>${jobTitle}</strong>.</p>
  <p style="margin:0 0 24px;color:#0a0a0a;font-size:15px;"><strong>${candidateName}</strong>${headline}</p>
  <p style="margin:0 0 32px;">
    <a href="${applicantsUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">Review application</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#888;">Or paste this link:</p>
  <p style="margin:0 0 32px;font-size:12px;color:#555;word-break:break-all;">${applicantsUrl}</p>
  ${FOOTER_HTML}
</body></html>`;
  return { subject, html, text };
}
