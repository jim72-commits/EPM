"use server";

import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { captureException, logEvent } from "@/lib/observability";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ResendState = {
  status: "idle" | "ok" | "rate_limited" | "error";
  message?: string;
};

const schema = z
  .object({
    email: z.string().email(),
    role: z.enum(["candidate", "employer"]).optional(),
  })
  .transform((v) => ({ ...v, email: v.email.trim().toLowerCase() }));

export async function resendConfirmation(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Email service isn't configured." };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "We need a valid email to resend the confirmation.",
    };
  }

  const { email, role } = parsed.data;
  const supabase = await createServerSupabaseClient();

  // Mirror the redirect used at signup so the confirmation link routes through
  // /login and lands on the right role-specific landing page.
  const emailRedirectTo = `${getAppBaseUrl()}/auth/callback?next=${encodeURIComponent(
    "/login",
  )}`;

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });

  if (error) {
    // Supabase returns 429 with status `over_email_send_rate_limit` when the
    // 60-second window from the last email hasn't elapsed. Treat that as a
    // soft "try again in a minute" instead of a hard error.
    const msg = error.message?.toLowerCase() ?? "";
    const status = (error as { status?: number }).status;
    if (status === 429 || msg.includes("rate limit") || msg.includes("over_email_send_rate_limit")) {
      logEvent("signup_verify_resend_rate_limited", {
        email_domain: email.split("@")[1] ?? "unknown",
        role: role ?? "unknown",
      });
      return {
        status: "rate_limited",
        message: "Wait a minute before requesting another email.",
      };
    }

    captureException(error, {
      scope: "signup.verify.resend",
      email_domain: email.split("@")[1] ?? "unknown",
      role: role ?? "unknown",
    });
    return {
      status: "error",
      message: "Couldn't resend the email. Try again in a minute.",
    };
  }

  logEvent("signup_verify_resend_sent", {
    email_domain: email.split("@")[1] ?? "unknown",
    role: role ?? "unknown",
  });
  return {
    status: "ok",
    message: "Sent. Check your inbox (and spam folder).",
  };
}
