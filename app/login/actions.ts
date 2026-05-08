"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signInWithPassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/login?reason=supabase");
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const { email, password, next } = parsed.data;
  const supabase = await createServerSupabaseClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !authData.user) {
    redirect("/login?error=credentials");
  }

  revalidatePath("/", "layout");

  // Heuristic: if the user verified their email very recently (i.e. they
  // just clicked the confirmation link and are signing in for the first
  // time), surface a one-shot celebration banner on landing. Five minutes
  // is generous enough to absorb a slow-moving inbox without misfiring on
  // returning users.
  const justVerified =
    authData.user.email_confirmed_at != null &&
    Date.now() - new Date(authData.user.email_confirmed_at).getTime() <
      5 * 60 * 1000;

  function withWelcome(target: string): string {
    if (!justVerified) return target;
    const sep = target.includes("?") ? "&" : "?";
    return `${target}${sep}welcome=verified`;
  }

  if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }

  const [
    { data: adminRow },
    { data: memberships },
    { data: candidateRow },
  ] = await Promise.all([
    supabase
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, organizations(slug)")
      .eq("user_id", authData.user.id)
      .limit(2),
    supabase
      .from("candidate_profiles")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .maybeSingle(),
  ]);

  if (adminRow) {
    redirect("/admin/jobs");
  }

  const firstSlug = memberships?.[0]
    ? Array.isArray(memberships[0].organizations)
      ? memberships[0].organizations[0]?.slug
      : (memberships[0].organizations as { slug?: string } | null)?.slug
    : undefined;

  if (memberships && memberships.length === 1 && firstSlug) {
    redirect(withWelcome(`/employer/${firstSlug}/jobs`));
  }
  if (memberships && memberships.length > 0) {
    redirect(withWelcome("/employer"));
  }

  if (candidateRow) {
    redirect(withWelcome("/me/applications"));
  }

  redirect("/login?error=no_access");
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?signed_out=1");
}
