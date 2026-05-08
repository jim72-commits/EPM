"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { describeFilters } from "@/lib/alerts/describe-filters";
import { alertUnsubscribedEmail } from "@/lib/email/alert-templates";
import { sendTransactional } from "@/lib/email/send";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";
import type { JobDirectoryFilters } from "@/lib/types/jobs";

const TokenSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

export async function confirmAlertUnsubscribe(
  formData: FormData,
): Promise<void> {
  const parsed = TokenSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) redirect("/alerts/unsubscribe?error=invalid");

  if (!isServiceRoleAvailable()) {
    redirect("/alerts/unsubscribe?error=unavailable");
  }

  const svc = createServiceRoleSupabaseClient();

  const { data: row, error: selErr } = await svc
    .from("job_alerts")
    .select("id, email, filters")
    .eq("unsubscribe_token", parsed.data.token)
    .maybeSingle();

  if (selErr || !row) {
    // Uniform redirect regardless of validity — prevents token enumeration.
    redirect("/alerts/unsubscribed");
  }

  const description = describeFilters(
    (row.filters ?? {}) as JobDirectoryFilters,
  );

  const { error: delErr } = await svc
    .from("job_alerts")
    .delete()
    .eq("id", row.id);

  if (delErr) {
    console.error("[alerts:unsubscribe] delete error", delErr);
    redirect("/alerts/unsubscribe?error=server_error");
  }

  const msg = alertUnsubscribedEmail({ email: row.email, description });
  await sendTransactional({
    to: row.email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  redirect("/alerts/unsubscribed");
}
