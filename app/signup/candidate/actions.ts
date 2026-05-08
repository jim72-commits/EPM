"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { friendlyDbError } from "@/lib/db-errors";
import { captureException, logEvent } from "@/lib/observability";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleAvailable,
} from "@/lib/supabase/service-role";

const signupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Use at least 8 characters"),
    full_name: z.string().min(1).max(200),
    country_code: z.enum(["US", "CA"]),
  })
  .transform((v) => ({
    ...v,
    email: v.email.trim().toLowerCase(),
    full_name: v.full_name.trim(),
  }));

function errorRedirect(params: URLSearchParams, message: string): never {
  params.set("error", message);
  redirect(`/signup/candidate?${params.toString()}`);
}

export async function signUpAsCandidate(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/signup/candidate?reason=supabase");
  }
  if (!isServiceRoleAvailable()) {
    redirect(
      `/signup/candidate?error=${encodeURIComponent(
        "Server isn't configured for signup yet (SUPABASE_SERVICE_ROLE_KEY missing).",
      )}`,
    );
  }

  const preserved = new URLSearchParams();
  for (const key of ["email", "full_name", "country_code"]) {
    const v = formData.get(key);
    if (typeof v === "string" && v.length) preserved.set(key, v);
  }

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    full_name: formData.get("full_name"),
    country_code: formData.get("country_code"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Check all fields";
    errorRedirect(preserved, msg);
  }

  const { email, password, full_name, country_code } = parsed.data;

  const supabase = await createServerSupabaseClient();

  // After confirming, route through /login so the existing role-routing
  // picks the right landing page (candidates get /me/applications with the
  // welcome=verified banner). Without this, the email link follows the
  // generic redirect set in the Supabase project, which can land candidates
  // on /admin/jobs and bounce them to a forbidden error.
  const emailRedirectTo = `${getAppBaseUrl()}/auth/callback?next=${encodeURIComponent(
    "/login",
  )}`;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (signUpError || !signUpData.user) {
    if (signUpError) {
      captureException(signUpError, {
        scope: "candidate.signup",
        email,
      });
    }
    errorRedirect(
      preserved,
      "Could not create account. Try a different email or sign in.",
    );
  }

  // Supabase obfuscates "email already registered" by returning the existing
  // user object with an empty identities array (and no error) when email
  // confirmation is enforced. Detecting it here is critical: signUpData.user.id
  // is the EXISTING user's id, so any subsequent service-role write would
  // silently mutate someone else's account, and the rollback path below would
  // delete it. Bail before touching anything.
  if ((signUpData.user.identities?.length ?? 0) === 0) {
    logEvent("candidate_signup_existing_email", { email });
    errorRedirect(
      preserved,
      "Could not create account. Try a different email or sign in.",
    );
  }

  const userId = signUpData.user.id;
  const svc = createServiceRoleSupabaseClient();

  // Seed a minimal candidate_profiles row. The candidate fills out the rest
  // on /me/profile. Using service role here because the user may not be
  // authenticated yet (email confirmation path).
  const { error: profileError } = await svc
    .from("candidate_profiles")
    .insert({
      user_id: userId,
      full_name,
      country_code,
    });

  if (profileError) {
    captureException(profileError, {
      scope: "candidate.signup.profile_seed",
      user_id: userId,
      email,
    });
    // Roll back the just-created auth user. Otherwise the email is "taken"
    // forever (unique on auth.users.email) but the user has no candidate
    // profile and can't recover without operator intervention.
    const { error: deleteError } = await svc.auth.admin.deleteUser(userId);
    if (deleteError) {
      captureException(deleteError, {
        event: "candidate_signup_orphan_cleanup_failed",
        user_id: userId,
        email,
      });
    }
    errorRedirect(
      preserved,
      friendlyDbError(profileError, { context: "profile" }),
    );
  }

  // Try to sign in immediately. If email confirmation is enforced, signIn
  // will fail — route to the verify page in that case.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  revalidatePath("/", "layout");

  if (signInError) {
    redirect(
      `/signup/verify?email=${encodeURIComponent(email)}&role=candidate`,
    );
  }

  redirect("/me/profile?welcome=1");
}
