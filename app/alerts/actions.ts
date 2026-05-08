"use server";

import { randomBytes } from "node:crypto";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { describeFilters } from "@/lib/alerts/describe-filters";
import { alertConfirmEmail } from "@/lib/email/alert-templates";
import { sendTransactional } from "@/lib/email/send";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";
import type { JobDirectoryFilters } from "@/lib/types/jobs";

const SubscribeSchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  platform: z.string().trim().max(64).optional(),
  role: z.string().trim().max(64).optional(),
  remote: z
    .enum(["remote", "hybrid", "onsite", "flexible"])
    .optional(),
  country: z.enum(["US", "CA"]).optional(),
  q: z.string().trim().max(120).optional(),
  source: z.string().trim().max(64).optional(),
});

function formString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function normalizeFilters(
  parsed: Omit<z.infer<typeof SubscribeSchema>, "email" | "source">,
): JobDirectoryFilters {
  const out: JobDirectoryFilters = {};
  if (parsed.platform) out.platform = parsed.platform;
  if (parsed.role) out.role = parsed.role;
  if (parsed.remote) out.remote = parsed.remote;
  if (parsed.country) out.country = parsed.country;
  if (parsed.q) out.q = parsed.q;
  return out;
}

/**
 * Creates or refreshes a pending job alert and emails a confirmation link.
 * Idempotent: if the same email+filters pair is already confirmed, we send a
 * fresh confirm email for a new subscription anyway (users can have multiple
 * alerts with different filters).
 */
export async function subscribeToAlerts(formData: FormData): Promise<void> {
  const raw = {
    email: formString(formData.get("email")),
    platform: formString(formData.get("platform")),
    role: formString(formData.get("role")),
    remote: formString(formData.get("remote")),
    country: formString(formData.get("country")),
    q: formString(formData.get("q")),
    source: formString(formData.get("source")),
  };

  const parsed = SubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/alerts?error=invalid_email");
  }

  if (!isServiceRoleAvailable()) {
    console.error(
      "[alerts] Missing SUPABASE_SERVICE_ROLE_KEY; cannot persist alert.",
    );
    redirect("/alerts?error=service_unavailable");
  }

  const email = parsed.data.email.toLowerCase();
  const filters = normalizeFilters(parsed.data);
  const confirmToken = randomBytes(32).toString("hex");
  const unsubscribeToken = randomBytes(32).toString("hex");
  const source = parsed.data.source ?? "site";

  const svc = createServiceRoleSupabaseClient();

  // Look for an existing alert with the same email+filters (whether confirmed
  // or pending). If found, refresh the confirm token so old emails stop
  // working; otherwise insert a new pending row.
  const { data: existing } = await svc
    .from("job_alerts")
    .select("id, confirmed_at, filters")
    .eq("email", email);

  const existingMatch = existing?.find(
    (row) => JSON.stringify(row.filters ?? {}) === JSON.stringify(filters),
  );

  if (existingMatch?.confirmed_at) {
    // Already-active alert for this exact filter set: send to pending page so
    // we don't leak the existence of the subscription.
    redirect(`/alerts/pending?email=${encodeURIComponent(email)}`);
  }

  if (existingMatch) {
    const { error: updErr } = await svc
      .from("job_alerts")
      .update({
        confirm_token: confirmToken,
        last_sent_confirm_at: new Date().toISOString(),
      })
      .eq("id", existingMatch.id);

    if (updErr) {
      console.error("[alerts] update failed", updErr);
      redirect("/alerts?error=server_error");
    }
  } else {
    const { error: insErr } = await svc.from("job_alerts").insert({
      email,
      filters,
      confirm_token: confirmToken,
      unsubscribe_token: unsubscribeToken,
      source,
      last_sent_confirm_at: new Date().toISOString(),
    });

    if (insErr) {
      console.error("[alerts] insert failed", insErr);
      redirect("/alerts?error=server_error");
    }
  }

  const confirmUrl = `${getAppBaseUrl()}/alerts/confirm?token=${confirmToken}`;
  const msg = alertConfirmEmail({
    confirmUrl,
    description: describeFilters(filters),
  });
  await sendTransactional({
    to: email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });

  redirect(`/alerts/pending?email=${encodeURIComponent(email)}`);
}
