"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { captureException, logEvent } from "@/lib/observability";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(1),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

export async function setNewPassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/login?reason=supabase");
  }

  const parsed = resetSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Check the fields";
    redirect(`/reset-password?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createServerSupabaseClient();

  // Recovery flow: by the time the user hits this action, the auth callback
  // has already exchanged the recovery token for a session, so updateUser
  // will operate on that session. If they navigated here without a session
  // we send them back to /forgot-password.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/forgot-password?error=expired");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    captureException(error, { event: "password_reset_failed" });
    redirect(
      `/reset-password?error=${encodeURIComponent(
        "Could not update password. Try requesting a new reset link.",
      )}`,
    );
  }

  logEvent("password_reset_succeeded", { user_id: userData.user.id });

  // Sign out so the next action (signing in with the new password) confirms
  // it works end-to-end and clears any stale tokens on shared devices.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?reason=password_updated");
}
