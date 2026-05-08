import "server-only";

import { FOOTER_HTML, FOOTER_TEXT } from "./footer";

type ConfirmArgs = {
  confirmUrl: string;
};

type UnsubscribeArgs = {
  email: string;
};

export function newsletterConfirmEmail(args: ConfirmArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { confirmUrl } = args;
  const subject = "Confirm your TheCOE newsletter subscription";
  const text = [
    "Thanks for subscribing to the TheCOE newsletter.",
    "",
    "Confirm your subscription:",
    confirmUrl,
    "",
    "If you didn't request this, ignore this email. Nothing happens without",
    "that confirmation click.",
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">Confirm your TheCOE newsletter subscription</h1>
  <p style="margin:0 0 16px;color:#555;">Thanks for subscribing to the TheCOE newsletter.</p>
  <p style="margin:0 0 24px;color:#555;">Click below to confirm your subscription. Nothing happens without this click.</p>
  <p style="margin:0 0 32px;">
    <a href="${confirmUrl}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 20px;font-weight:500;">Confirm subscription</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;color:#888;">Or paste this link into your browser:</p>
  <p style="margin:0 0 32px;font-size:12px;color:#555;word-break:break-all;">${confirmUrl}</p>
  <p style="margin:0 0 4px;font-size:12px;color:#888;">If you didn't request this, ignore this email.</p>
  ${FOOTER_HTML}
</body></html>`;
  return { subject, html, text };
}

export function newsletterUnsubscribedEmail(args: UnsubscribeArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "You're unsubscribed from TheCOE";
  const text = [
    `Your address (${args.email}) has been removed from the TheCOE newsletter.`,
    "",
    "Change your mind? Subscribe again any time at thecoe.com/newsletter.",
    "",
    FOOTER_TEXT,
  ].join("\n");
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0a0a0a;line-height:1.5;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;">You're unsubscribed</h1>
  <p style="margin:0 0 16px;color:#555;">Your address (<strong>${args.email}</strong>) has been removed from the TheCOE newsletter.</p>
  <p style="margin:0 0 24px;color:#555;">Change your mind? Subscribe again any time.</p>
  ${FOOTER_HTML}
</body></html>`;
  return { subject, html, text };
}
