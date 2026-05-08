"use server";

import { redirect } from "next/navigation";

import { getOptionalAuth } from "@/lib/auth/admin";
import { captureException, logEvent } from "@/lib/observability";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const KNOWN_ERRORS: Record<string, string> = {
  not_authenticated: "Sign in first to accept the invite.",
  invite_not_found: "Invite link is invalid or expired.",
  invite_already_accepted: "This invite has already been accepted.",
  invite_revoked: "This invite was revoked. Ask the owner to send a new one.",
  invite_expired: "This invite expired. Ask the owner to send a new one.",
};

function tokenErrorMessage(rawMessage: string): string {
  const known = Object.entries(KNOWN_ERRORS).find(([code]) =>
    rawMessage.includes(code),
  );
  if (known) return known[1];
  return rawMessage;
}

export async function acceptInvite(token: string) {
  const auth = await getOptionalAuth();
  if (!auth.user) {
    redirect(
      `/login?next=${encodeURIComponent(`/invite/${token}`)}&reason=invite`,
    );
  }

  const supabase = await createServerSupabaseClient();

  // accept_org_invite is a SECURITY DEFINER RPC that:
  //   1. hashes the supplied token
  //   2. matches it to a pending invite
  //   3. inserts/updates organization_members
  //   4. stamps the invite as accepted
  // All within a single transaction. The function returns the org_slug so
  // we know where to redirect the new member.
  const { data, error } = await supabase.rpc("accept_org_invite", {
    invite_token: token,
  });

  if (error) {
    const friendly = tokenErrorMessage(error.message);
    captureException(error, { scope: "invite.accept", message: friendly });
    redirect(
      `/invite/${token}?error=${encodeURIComponent(friendly)}`,
    );
  }

  type AcceptResult = {
    organization_id: string;
    organization_slug: string;
    role: "owner" | "member";
  };

  const rows = (data ?? []) as AcceptResult[];
  const result = rows[0];
  if (!result) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Invite link is invalid or expired.")}`);
  }

  logEvent("org_invite_accepted", {
    organization_id: result.organization_id,
    role: result.role,
  });

  redirect(
    `/employer/${result.organization_slug}/jobs?welcome=invite`,
  );
}
