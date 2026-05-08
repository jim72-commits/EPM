import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import type { User } from "@supabase/supabase-js";

export type MembershipSummary = {
  organization_id: string;
  role: "owner" | "member";
  organization: { name: string; slug: string };
};

export async function getOptionalAuth(): Promise<{
  configured: boolean;
  user: User | null;
  isAdmin: boolean;
  memberships: MembershipSummary[];
  hasCandidateProfile: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      user: null,
      isAdmin: false,
      memberships: [],
      hasCandidateProfile: false,
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      configured: true,
      user: null,
      isAdmin: false,
      memberships: [],
      hasCandidateProfile: false,
    };
  }

  const [{ data: adminRow }, memberships, { data: candidateRow }] = await Promise.all([
    supabase
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    loadMemberships(supabase, user.id),
    supabase
      .from("candidate_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    configured: true,
    user,
    isAdmin: Boolean(adminRow),
    memberships,
    hasCandidateProfile: Boolean(candidateRow),
  };
}

export async function requireAdmin(): Promise<{
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
    redirect("/login?next=/admin/jobs");
  }

  const { data: adminRow } = await supabase
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    redirect("/login?error=forbidden");
  }

  return { user, supabase };
}

async function loadMemberships(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
): Promise<MembershipSummary[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
        organization_id,
        role,
        organizations ( name, slug )
      `,
    )
    .eq("user_id", userId);

  if (error || !data) return [];

  return data
    .map((row) => {
      const org = Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations;
      if (!org) return null;
      return {
        organization_id: row.organization_id as string,
        role: row.role as "owner" | "member",
        organization: { name: org.name, slug: org.slug },
      } satisfies MembershipSummary;
    })
    .filter((m): m is MembershipSummary => m !== null)
    .sort((a, b) =>
      a.organization.name.localeCompare(b.organization.name, "en"),
    );
}
