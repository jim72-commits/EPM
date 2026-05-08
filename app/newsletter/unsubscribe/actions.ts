"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { newsletterUnsubscribedEmail } from "@/lib/email/newsletter-templates";
import { sendTransactional } from "@/lib/email/send";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

const TokenSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

export async function confirmUnsubscribe(formData: FormData): Promise<void> {
  const parsed = TokenSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) redirect("/newsletter/unsubscribe?error=invalid");

  if (!isServiceRoleAvailable()) {
    redirect("/newsletter/unsubscribe?error=unavailable");
  }

  const svc = createServiceRoleSupabaseClient();

  const { data: row, error: selErr } = await svc
    .from("newsletter_subscribers")
    .select("id, email")
    .eq("unsubscribe_token", parsed.data.token)
    .maybeSingle();

  if (selErr || !row) {
    // Redirect to the success page anyway so attackers cannot enumerate
    // tokens by observing different responses.
    redirect("/newsletter/unsubscribed");
  }

  const { error: delErr } = await svc
    .from("newsletter_subscribers")
    .delete()
    .eq("id", row.id);

  if (delErr) {
    console.error("[newsletter:unsubscribe] delete error", delErr);
    redirect("/newsletter/unsubscribe?error=server_error");
  }

  const msg = newsletterUnsubscribedEmail({ email: row.email });
  await sendTransactional({
    to: row.email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  redirect("/newsletter/unsubscribed");
}
