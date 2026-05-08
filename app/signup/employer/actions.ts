"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import { friendlyDbError } from "@/lib/db-errors";
import { captureException, logEvent } from "@/lib/observability";
import { slugify } from "@/lib/slugify";
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
    company_name: z.string().min(1).max(200),
    country_code: z.enum(["US", "CA"]),
    organization_type: z.enum(["direct", "agency"]),
  })
  .transform((v) => ({
    ...v,
    email: v.email.trim().toLowerCase(),
    company_name: v.company_name.trim(),
  }));

function errorRedirect(params: URLSearchParams, message: string): never {
  params.set("error", message);
  redirect(`/signup/employer?${params.toString()}`);
}

export async function signUpWithOrg(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/signup/employer?reason=supabase");
  }
  if (!isServiceRoleAvailable()) {
    redirect(
      `/signup/employer?error=${encodeURIComponent(
        "Server isn't configured for signup yet (SUPABASE_SERVICE_ROLE_KEY missing).",
      )}`,
    );
  }

  const preserved = new URLSearchParams();
  const preserveable = ["email", "company_name", "country_code", "organization_type"];
  for (const key of preserveable) {
    const v = formData.get(key);
    if (typeof v === "string" && v.length) preserved.set(key, v);
  }

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    company_name: formData.get("company_name"),
    country_code: formData.get("country_code"),
    organization_type: formData.get("organization_type"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Check all fields";
    errorRedirect(preserved, msg);
  }

  const { email, password, company_name, country_code, organization_type } =
    parsed.data;

  const supabase = await createServerSupabaseClient();

  // Route the email confirmation link through /login so role-based routing
  // sends the user to /employer/<slug>/jobs (with the welcome=verified
  // banner). Without an explicit redirect, the link follows whatever's set
  // in the Supabase project email template, which may not match.
  const emailRedirectTo = `${getAppBaseUrl()}/auth/callback?next=${encodeURIComponent(
    "/login",
  )}`;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (signUpError || !signUpData.user) {
    // Don't leak the raw auth error — its message can confirm whether an
    // email is already registered, which is a low-grade enumeration leak.
    // Log the real error for ops; show a flat, friendly message to the user.
    if (signUpError) {
      captureException(signUpError, {
        scope: "employer.signup",
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
  // confirmation is enforced. Detecting it here is critical: without this
  // check we'd insert a fresh organization owned by the existing user (silent
  // account pollution), and a downstream member-insert failure would route
  // through rollbackAuthUser and DELETE that user's account.
  if ((signUpData.user.identities?.length ?? 0) === 0) {
    logEvent("employer_signup_existing_email", { email });
    errorRedirect(
      preserved,
      "Could not create account. Try a different email or sign in.",
    );
  }

  const userId = signUpData.user.id;
  const svc = createServiceRoleSupabaseClient();

  async function rollbackAuthUser(reason: string): Promise<void> {
    const { error } = await svc.auth.admin.deleteUser(userId);
    if (error) {
      captureException(error, {
        event: "employer_signup_orphan_cleanup_failed",
        reason,
        user_id: userId,
        email,
      });
    }
  }

  const baseSlug = slugify(company_name) || "organization";
  let slug = baseSlug;
  let attempt = 0;
  while (attempt < 5) {
    const { data: existing } = await svc
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    attempt += 1;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: org, error: orgError } = await svc
    .from("organizations")
    .insert({
      name: company_name,
      slug,
      organization_type,
      country_code,
    })
    .select("id, slug")
    .single();

  if (orgError || !org) {
    if (orgError) {
      captureException(orgError, {
        scope: "employer.signup.org_create",
        email,
        slug,
      });
    }
    await rollbackAuthUser("org_create_failed");
    errorRedirect(
      preserved,
      orgError
        ? friendlyDbError(orgError, { context: "organization", slug })
        : "Could not create organization. Please try again.",
    );
  }

  const { error: memberError } = await svc
    .from("organization_members")
    .insert({
      user_id: userId,
      organization_id: org.id,
      role: "owner",
    });

  if (memberError) {
    captureException(memberError, {
      scope: "employer.signup.member_insert",
      email,
      organization_id: org.id,
    });
    // Org row was already created. Clean up both rows so the email is
    // freed up and the dangling org doesn't show on /employers.
    await svc.from("organizations").delete().eq("id", org.id);
    await rollbackAuthUser("member_insert_failed");
    errorRedirect(
      preserved,
      friendlyDbError(memberError, { context: "organization" }),
    );
  }

  // If email confirmation is enforced in Supabase, signUp won't auto-sign-in.
  // Detect this: if sign-in fails right after sign-up, send them to verify.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  revalidatePath("/", "layout");

  if (signInError) {
    redirect(
      `/signup/verify?email=${encodeURIComponent(email)}&role=employer&org=${encodeURIComponent(
        org.slug,
      )}`,
    );
  }

  redirect(`/employer/${org.slug}/jobs/new?welcome=1`);
}
