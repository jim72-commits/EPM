"use server";

import { randomBytes } from "node:crypto";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { newsletterConfirmEmail } from "@/lib/email/newsletter-templates";
import { sendTransactional } from "@/lib/email/send";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

const SubscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(254)
    .email(),
  source: z.string().trim().max(64).optional(),
});

/**
 * Creates or refreshes a pending newsletter subscription and emails a
 * confirmation link. Idempotent: re-subscribing an existing email either
 * resends (if pending) or is a no-op (if already confirmed).
 */
export async function subscribeToNewsletter(formData: FormData): Promise<void> {
  const parsed = SubscribeSchema.safeParse({
    email: formData.get("email"),
    source: formData.get("source") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/newsletter?error=invalid_email");
  }

  if (!isServiceRoleAvailable()) {
    console.error(
      "[newsletter] Missing SUPABASE_SERVICE_ROLE_KEY; cannot persist subscriber.",
    );
    redirect("/newsletter?error=service_unavailable");
  }

  const email = parsed.data.email.toLowerCase();
  const source = parsed.data.source ?? "site";
  const confirmToken = randomBytes(32).toString("hex");
  const unsubscribeToken = randomBytes(32).toString("hex");

  const svc = createServiceRoleSupabaseClient();

  const { data: existing } = await svc
    .from("newsletter_subscribers")
    .select("id, confirmed_at")
    .eq("email", email)
    .maybeSingle();

  if (existing?.confirmed_at) {
    // Already confirmed. Don't leak that by showing different UX — the user
    // sees the same "check your inbox" page either way.
    redirect(`/newsletter/pending?email=${encodeURIComponent(email)}`);
  }

  if (existing) {
    // Re-issue a fresh confirm token so old emails stop working.
    const { error: updErr } = await svc
      .from("newsletter_subscribers")
      .update({
        confirm_token: confirmToken,
        last_sent_confirm_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updErr) {
      console.error("[newsletter] update failed", updErr);
      redirect("/newsletter?error=server_error");
    }
  } else {
    const { error: insErr } = await svc
      .from("newsletter_subscribers")
      .insert({
        email,
        confirm_token: confirmToken,
        unsubscribe_token: unsubscribeToken,
        source,
        last_sent_confirm_at: new Date().toISOString(),
      });

    if (insErr) {
      console.error("[newsletter] insert failed", insErr);
      redirect("/newsletter?error=server_error");
    }
  }

  const confirmUrl = `${getAppBaseUrl()}/newsletter/confirm?token=${confirmToken}`;
  const msg = newsletterConfirmEmail({ confirmUrl });
  await sendTransactional({
    to: email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  redirect(`/newsletter/pending?email=${encodeURIComponent(email)}`);
}
