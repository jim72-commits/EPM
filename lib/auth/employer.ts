import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import type { User } from "@supabase/supabase-js";

export type EmployerOrg = {
  id: string;
  name: string;
  slug: string;
  organization_type: "direct" | "agency";
  country_code: "US" | "CA";
};

export async function requireEmployer(): Promise<{
  user: User;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}> {
  if (!isSupabaseConfigured()) {
    redirect("/login?reason=supabase");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/employer");
  }

  return { user, supabase };
}

export async function requireOrgMember(orgSlug: string): Promise<{
  user: User;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  org: EmployerOrg;
  role: "owner" | "member";
}> {
  const { user, supabase } = await requireEmployer();

  const { data: org } = await supabase
    .from("organizations")
    .select("id,name,slug,organization_type,country_code")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (!org) {
    redirect("/employer?error=not_found");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!membership) {
    redirect("/employer?error=not_a_member");
  }

  return {
    user,
    supabase,
    org: org as EmployerOrg,
    role: membership.role as "owner" | "member",
  };
}
