import "server-only";

import { FOOTER_HTML, FOOTER_TEXT } from "./footer";

type Common = {
  candidateName: string;
  jobTitle: string;
  organizationName: string;
  applicationUrl: string;
};

type ListingClosedKind =
  | "hired_elsewhere"
  | "not_hired_no_fit"
  | "not_hired_cancelled"
  // Sent to non-hired applicants when the employer hired someone else from
  // the same applicant pool. Distinct from `not_hired_no_fit` (which lies if
  // there *was* a hire) and `hired_elsewhere` (which is about off-platform
  // hires). We deliberately don't name the chosen candidate.
  | "moved_forward_with_other";

type ListingClosedArgs = Common & {
  kind: ListingClosedKind;
};

type EmailPayload = { subject: string; html: string; text: string };

function shellHtml(opts: {
  heading: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const paragraphsHtml = opts.paragraphs
    .map((p) => `<p style="margin:0 0 16px;color:#555;">${p}</p>`)
    .join("");
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">${opts.heading}</h1>
  ${paragraphsHtml}
  <p style="margin:0 0 32px;">
    <a href="${opts.ctaUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">${opts.ctaLabel}</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#888;">Or paste this link:</p>
  <p style="margin:0 0 32px;font-size:12px;color:#555;word-break:break-all;">${opts.ctaUrl}</p>
  ${FOOTER_HTML}
</body></html>`;
}

/** Employer moved an application to `shortlisted`. Real positive signal. */
export function applicationShortlistedEmail(args: Common): EmailPayload {
  const subject = `${args.organizationName} shortlisted you for ${args.jobTitle}`;
  const text = [
    `Hi ${args.candidateName},`,
    "",
    `Good news — ${args.organizationName} moved you to their shortlist for ${args.jobTitle}.`,
    "",
    "Most teams reach out next steps directly (interview scheduling, screening calls). Watch your inbox, and check your application page for the latest status:",
    args.applicationUrl,
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = shellHtml({
    heading: "You've been shortlisted",
    paragraphs: [
      `Hi ${args.candidateName},`,
      `<strong>${args.organizationName}</strong> moved you to their shortlist for <strong>${args.jobTitle}</strong>.`,
      `Most teams reach out next steps directly (interview scheduling, screening calls). Watch your inbox.`,
    ],
    ctaLabel: "View application",
    ctaUrl: args.applicationUrl,
  });
  return { subject, html, text };
}

/**
 * Employer moved an application to `rejected` directly (i.e. before close).
 * Soft, honest tone — most candidates already suspect when they hit this.
 */
export function applicationRejectedEmail(args: Common): EmailPayload {
  const subject = `Update on your application — ${args.jobTitle}`;
  const text = [
    `Hi ${args.candidateName},`,
    "",
    `${args.organizationName} reviewed your application for ${args.jobTitle} and decided not to move forward.`,
    "",
    "We know it's not the news you were hoping for. If it helps: every team has its own bar, and a no on one Anaplan role doesn't mean much for the next one. The board has more open roles where your experience could land better.",
    "",
    "View your application:",
    args.applicationUrl,
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = shellHtml({
    heading: "Application update",
    paragraphs: [
      `Hi ${args.candidateName},`,
      `<strong>${args.organizationName}</strong> reviewed your application for <strong>${args.jobTitle}</strong> and decided not to move forward.`,
      `Every team has its own bar — a no on one Anaplan role doesn't mean much for the next. There are more open roles on the board where your experience could land better.`,
    ],
    ctaLabel: "View application",
    ctaUrl: args.applicationUrl,
  });
  return { subject, html, text };
}

/** Employer picked this candidate as the hire on listing close. */
export function applicationHiredEmail(args: Common): EmailPayload {
  const subject = `You were hired for ${args.jobTitle}`;
  const text = [
    `Hi ${args.candidateName},`,
    "",
    `${args.organizationName} just closed their listing for ${args.jobTitle} and attributed the hire to you. Congrats.`,
    "",
    `We track this on both sides — your hire counts toward our success record, and ${args.organizationName}'s record shows they actually fill roles here.`,
    "",
    "Your application page:",
    args.applicationUrl,
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = shellHtml({
    heading: "You got the role",
    paragraphs: [
      `Hi ${args.candidateName},`,
      `<strong>${args.organizationName}</strong> just closed their listing for <strong>${args.jobTitle}</strong> and attributed the hire to you. Congrats.`,
      `We track this on both sides — your hire counts toward our success record, and <strong>${args.organizationName}</strong>'s record shows they actually fill roles here.`,
    ],
    ctaLabel: "View application",
    ctaUrl: args.applicationUrl,
  });
  return { subject, html, text };
}

/**
 * Listing was closed and this candidate wasn't picked. Three flavors based
 * on what the employer reported, so candidates get accurate context rather
 * than a generic "you weren't selected" sting.
 *
 * The body is rendered in two passes: text version uses raw names, HTML
 * version uses `bold(name)` placeholders that we substitute with `<strong>`
 * tags. This avoids `.replace()` only-first-occurrence bugs when the org or
 * job title appears more than once in a sentence.
 */
export function listingClosedEmail(args: ListingClosedArgs): EmailPayload {
  const { kind, candidateName, jobTitle, organizationName, applicationUrl } =
    args;
  const orgB = `<strong>${organizationName}</strong>`;
  const jobB = `<strong>${jobTitle}</strong>`;

  let heading: string;
  let textBody: string[];
  let htmlBody: string[];
  let subject: string;

  switch (kind) {
    case "hired_elsewhere":
      subject = `${jobTitle} has been filled`;
      heading = `${jobTitle} has been filled`;
      textBody = [
        `Hi ${candidateName},`,
        `${organizationName} closed their listing for ${jobTitle}. They filled the role through a different channel, so it wasn't a no on you specifically — there just isn't an open seat to move you into.`,
        `There are more Anaplan roles open right now. Keep your profile fresh and the next one will get a faster look.`,
      ];
      htmlBody = [
        `Hi ${candidateName},`,
        `${orgB} closed their listing for ${jobB}. They filled the role through a different channel, so it wasn't a no on you specifically — there just isn't an open seat to move you into.`,
        `There are more Anaplan roles open right now. Keep your profile fresh and the next one will get a faster look.`,
      ];
      break;
    case "not_hired_no_fit":
      subject = `${jobTitle} has been closed`;
      heading = `${jobTitle} has been closed`;
      textBody = [
        `Hi ${candidateName},`,
        `${organizationName} closed their listing for ${jobTitle} without making a hire. Sometimes teams reset their bar, sometimes they pause. Either way, this one is done.`,
        `Other Anaplan roles are open on TheCOE. A no on one team rarely says much about how the next one will go.`,
      ];
      htmlBody = [
        `Hi ${candidateName},`,
        `${orgB} closed their listing for ${jobB} without making a hire. Sometimes teams reset their bar, sometimes they pause. Either way, this one is done.`,
        `Other Anaplan roles are open on TheCOE. A no on one team rarely says much about how the next one will go.`,
      ];
      break;
    case "not_hired_cancelled":
      subject = `${jobTitle} has been pulled`;
      heading = `${jobTitle} has been pulled`;
      textBody = [
        `Hi ${candidateName},`,
        `${organizationName} pulled the listing for ${jobTitle} — usually means headcount changed or the role was scrapped. Not a reflection of your application.`,
        `There are other Anaplan roles open right now if you want to keep the search going.`,
      ];
      htmlBody = [
        `Hi ${candidateName},`,
        `${orgB} pulled the listing for ${jobB} — usually means headcount changed or the role was scrapped. Not a reflection of your application.`,
        `There are other Anaplan roles open right now if you want to keep the search going.`,
      ];
      break;
    case "moved_forward_with_other":
      subject = `${jobTitle} has been filled`;
      heading = `${jobTitle} has been filled`;
      textBody = [
        `Hi ${candidateName},`,
        `${organizationName} closed their listing for ${jobTitle} and moved forward with another candidate. It came down to the specifics of this role rather than your application overall.`,
        `Other Anaplan roles are open on TheCOE. Keep your profile fresh and the next one will get a faster look.`,
      ];
      htmlBody = [
        `Hi ${candidateName},`,
        `${orgB} closed their listing for ${jobB} and moved forward with another candidate. It came down to the specifics of this role rather than your application overall.`,
        `Other Anaplan roles are open on TheCOE. Keep your profile fresh and the next one will get a faster look.`,
      ];
      break;
  }

  const text = [
    textBody[0],
    "",
    textBody.slice(1).join("\n\n"),
    "",
    "Your application page:",
    applicationUrl,
    "",
    FOOTER_TEXT,
  ].join("\n");

  const html = shellHtml({
    heading,
    paragraphs: htmlBody,
    ctaLabel: "View application",
    ctaUrl: applicationUrl,
  });

  return { subject, html, text };
}
