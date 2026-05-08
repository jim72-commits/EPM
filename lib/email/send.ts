import "server-only";

export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = {
  delivered: boolean;
  providerId?: string;
  error?: string;
};

/**
 * Provider-agnostic transactional email sender.
 *
 * Wire order:
 * 1. If `RESEND_API_KEY` is set, sends via Resend REST API (no SDK dependency).
 * 2. Otherwise logs to the server console so dev and early-production flows
 *    still produce useful feedback (e.g. confirmation links).
 *
 * Swap providers by editing just this file; call sites stay unchanged.
 */
export async function sendTransactional(
  email: TransactionalEmail,
): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "TheCOE <hello@thecoe.com>";

  if (!apiKey) {
    console.log(
      `[email:stub] to=${email.to} subject=${JSON.stringify(email.subject)}\n` +
        `---\n${email.text}\n---`,
    );
    return { delivered: false, error: "no_provider_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend HTTP ${res.status}: ${body}`);
      return { delivered: false, error: `resend_http_${res.status}` };
    }

    const json = (await res.json()) as { id?: string };
    return { delivered: true, providerId: json.id };
  } catch (err) {
    console.error("[email] Resend send failed", err);
    return {
      delivered: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
