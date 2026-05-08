"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { findUserIdByEmail } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/admin";
import { friendlyDbError } from "@/lib/db-errors";
import { logEvent } from "@/lib/observability";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addMemberSchema = z.object({
  organization_id: z.string().uuid(),
  identifier: z
    .string()
    .min(1, "Enter an email or User UID")
    .max(320, "Identifier too long"),
  role: z.enum(["owner", "member"]).default("member"),
});

export async function addOrgMember(formData: FormData) {
  const { supabase, user: actor } = await requireAdmin();

  const parsed = addMemberSchema.safeParse({
    organization_id: formData.get("organization_id"),
    // Back-compat: legacy callers may still send `user_id`. We accept either
    // input name and normalize to `identifier`, so existing scripts and the
    // new email-aware UI both work.
    identifier:
      (formData.get("identifier") as string | null) ??
      (formData.get("user_id") as string | null) ??
      "",
    role: formData.get("role") ?? "member",
  });

  if (!parsed.success) {
    const orgId = String(formData.get("organization_id") ?? "");
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(
      `/admin/organizations/${orgId}/members?error=${encodeURIComponent(msg)}`,
    );
  }

  const { organization_id, role } = parsed.data;
  const identifier = parsed.data.identifier.trim();

  let userId: string | null = null;
  if (UUID_RE.test(identifier)) {
    userId = identifier;
  } else if (EMAIL_RE.test(identifier)) {
    userId = await findUserIdByEmail(identifier);
    if (!userId) {
      redirect(
        `/admin/organizations/${organization_id}/members?error=${encodeURIComponent(
          `No TheCOE account found for ${identifier}. Have them sign up first.`,
        )}`,
      );
    }
  } else {
    redirect(
      `/admin/organizations/${organization_id}/members?error=${encodeURIComponent(
        "Enter a valid email address or User UID.",
      )}`,
    );
  }

  if (!userId) {
    // Defensive: TS narrowing — should be unreachable since both branches
    // either set userId or redirect.
    redirect(
      `/admin/organizations/${organization_id}/members?error=lookup_failed`,
    );
  }

  // Look up any existing membership so we can either no-op (same role) or
  // surface a "role changed" affordance instead of silently demoting an
  // owner to member when an admin retypes an email.
  const { data: existing } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing && existing.role === role) {
    redirect(
      `/admin/organizations/${organization_id}/members?error=${encodeURIComponent(
        "That user is already a member of this org with the same role.",
      )}`,
    );
  }

  const { error } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id,
        user_id: userId,
        role,
      },
      { onConflict: "user_id,organization_id" },
    );

  if (error) {
    redirect(
      `/admin/organizations/${organization_id}/members?error=${encodeURIComponent(
        friendlyDbError(error, { context: "organization" }),
      )}`,
    );
  }

  logEvent("admin.org_member_upsert", {
    actor_user_id: actor.id,
    organization_id,
    target_user_id: userId,
    role,
    previous_role: existing?.role ?? null,
    via: UUID_RE.test(identifier) ? "uid" : "email",
  });

  revalidatePath(`/admin/organizations/${organization_id}/members`);
  redirect(
    `/admin/organizations/${organization_id}/members?saved=${
      existing ? "role_updated" : "added"
    }`,
  );
}

const removeMemberSchema = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

export async function removeOrgMember(formData: FormData) {
  const { supabase, user: actor } = await requireAdmin();

  const parsed = removeMemberSchema.safeParse({
    organization_id: formData.get("organization_id"),
    user_id: formData.get("user_id"),
  });

  if (!parsed.success) {
    const orgId = String(formData.get("organization_id") ?? "");
    redirect(`/admin/organizations/${orgId}/members?error=invalid`);
  }

  // Capture the role before deletion so the audit log records what we
  // actually removed (owner vs member is meaningful for incident review).
  const { data: existing } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", parsed.data.organization_id)
    .eq("user_id", parsed.data.user_id)
    .maybeSingle();

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", parsed.data.organization_id)
    .eq("user_id", parsed.data.user_id);

  if (error) {
    redirect(
      `/admin/organizations/${parsed.data.organization_id}/members?error=${encodeURIComponent(
        friendlyDbError(error, { context: "organization" }),
      )}`,
    );
  }

  logEvent("admin.org_member_removed", {
    actor_user_id: actor.id,
    organization_id: parsed.data.organization_id,
    target_user_id: parsed.data.user_id,
    role: existing?.role ?? null,
  });

  revalidatePath(`/admin/organizations/${parsed.data.organization_id}/members`);
  redirect(
    `/admin/organizations/${parsed.data.organization_id}/members?saved=removed`,
  );
}
