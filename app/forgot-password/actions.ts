"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { captureException, logEvent } from "@/lib/observability";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

const requestSchema = z.object({
  email: z.string().email(),
});

export async function requestPasswordReset(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/login?reason=supabase");
  }

  const parsed = requestSchema.safeParse({ email: formData.get("email") });

  // Always redirect to the "sent" state regardless of whether the email
  // exists, so we never leak account existence to an attacker probing
  // arbitrary emails.
  if (!parsed.success) {
    redirect("/forgot-password?sent=1");
  }

  const { email } = parsed.data;
  const supabase = await createServerSupabaseClient();
  const redirectTo = `${getAppBaseUrl()}/auth/callback?next=${encodeURIComponent(
    "/reset-password",
  )}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Log it server-side but don't surface — see comment above.
    captureException(error, { event: "password_reset_request_failed", email });
  } else {
    logEvent("password_reset_requested", { email });
  }

  redirect("/forgot-password?sent=1");
}
