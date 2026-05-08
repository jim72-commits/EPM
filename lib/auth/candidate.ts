import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CandidateProfile = {
  user_id: string;
  full_name: string;
  headline: string | null;
  country_code: "US" | "CA";
  location_label: string | null;
  work_auth_us: "citizen" | "permanent_resident" | "visa_required" | "none";
  work_auth_ca: "citizen" | "permanent_resident" | "visa_required" | "none";
  years_experience_anaplan: number;
  open_to_remote: boolean;
  open_to_hybrid: boolean;
  open_to_onsite: boolean;
  linkedin_url: string | null;
  portfolio_url: string | null;
  bio: string | null;
  resume_path: string | null;
  resume_uploaded_at: string | null;
  digest_opt_in: boolean;
  digest_last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CandidateCredential = {
  id: string;
  user_id: string;
  credential_type: "certification" | "role_history" | "education";
  title: string;
  organization_name: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

const PROFILE_COLUMNS =
  "user_id,full_name,headline,country_code,location_label,work_auth_us,work_auth_ca,years_experience_anaplan,open_to_remote,open_to_hybrid,open_to_onsite,linkedin_url,portfolio_url,bio,resume_path,resume_uploaded_at,digest_opt_in,digest_last_sent_at,created_at,updated_at";

/**
 * Require the caller to be authenticated AND hold a candidate profile.
 * Admins / employers without a candidate_profiles row are redirected to
 * the candidate signup page — they can hold multiple roles but the /me
 * experience is candidate-only.
 */
export async function requireCandidate(): Promise<{
  user: User;
  profile: CandidateProfile;
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
    redirect("/login?next=/me/profile");
  }

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/signup/candidate?reason=complete_profile");
  }

  return { user, profile: profile as CandidateProfile, supabase };
}

/**
 * Optional candidate-profile fetch — does not redirect. Used by header nav
 * and pages that render differently depending on candidate status.
 */
export async function getOptionalCandidateProfile(): Promise<CandidateProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("candidate_profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as CandidateProfile | null) ?? null;
}

/**
 * Minimum-bar check used before allowing an application submission.
 * Keeps the rule in one place so employer-facing signals stay honest.
 *
 * Anything more than this (headline copy, years of experience, links,
 * etc.) is encouraged via `getProfilePolishMissing` but does NOT block
 * the apply button.
 */
export function isProfileApplyReady(profile: CandidateProfile): boolean {
  return getApplyReadyMissing(profile).length === 0;
}

/**
 * Returns the list of human-readable fields that must be filled before
 * the candidate can submit an application. Single source of truth; both
 * the apply route and the profile page consume this.
 */
export function getApplyReadyMissing(profile: CandidateProfile): string[] {
  const missing: string[] = [];
  if (profile.full_name.trim().length === 0) missing.push("full name");
  if (!profile.resume_path) missing.push("resume");
  return missing;
}

/**
 * Returns the list of human-readable fields that, while optional, make
 * the profile materially stronger to employers. Used for soft nudges on
 * the profile page once the apply-ready bar is met.
 */
export function getProfilePolishMissing(profile: CandidateProfile): string[] {
  const missing: string[] = [];
  if (!profile.headline || !profile.headline.trim()) missing.push("headline");
  if (profile.years_experience_anaplan < 1) missing.push("Anaplan years");
  return missing;
}
