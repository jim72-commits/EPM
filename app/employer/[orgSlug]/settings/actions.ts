"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOrgMember } from "@/lib/auth/employer";
import { captureException, logEvent } from "@/lib/observability";
import { isValidPublicUrl } from "@/lib/url";

const MAX_LOGO_BYTES = 1 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

function errorRedirect(orgSlug: string, message: string): never {
  redirect(
    `/employer/${orgSlug}/settings?error=${encodeURIComponent(message)}`,
  );
}

/**
 * Upload (or replace) the organization's logo. The bucket is public and the
 * RLS policy on org-logos checks org membership via storage.foldername()[1],
 * so writes here go through the user's own session — no service role
 * needed.
 */
export async function uploadOrgLogo(orgSlug: string, formData: FormData) {
  const { supabase, org } = await requireOrgMember(orgSlug);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    errorRedirect(orgSlug, "Pick an image file (PNG, JPG, WebP, or SVG).");
  }
  if (file.size > MAX_LOGO_BYTES) {
    errorRedirect(orgSlug, "Logo must be under 1 MB.");
  }
  const ext = ALLOWED_LOGO_TYPES.get(file.type);
  if (!ext) {
    errorRedirect(orgSlug, "Logo must be PNG, JPG, WebP, or SVG.");
  }

  const key = `${org.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("org-logos")
    .upload(key, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    captureException(uploadError, {
      scope: "employer.upload_logo",
      org_id: org.id,
    });
    errorRedirect(orgSlug, uploadError.message);
  }

  const { data: existing } = await supabase
    .from("organizations")
    .select("logo_storage_path")
    .eq("id", org.id)
    .maybeSingle();

  const previousPath = (existing as { logo_storage_path: string | null } | null)
    ?.logo_storage_path;

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ logo_storage_path: key })
    .eq("id", org.id);

  if (updateError) {
    captureException(updateError, {
      scope: "employer.upload_logo.persist",
      org_id: org.id,
    });
    errorRedirect(orgSlug, updateError.message);
  }

  // Best-effort cleanup of the prior logo. Failure here is non-fatal — we
  // just leave a tiny orphan in storage rather than block the user.
  if (previousPath && previousPath !== key) {
    await supabase.storage.from("org-logos").remove([previousPath]);
  }

  logEvent("org_logo_uploaded", {
    organization_id: org.id,
    bytes: file.size,
    ext,
  });

  revalidatePath(`/employer/${orgSlug}/settings`);
  revalidatePath(`/employers/${orgSlug}`);
  revalidatePath("/jobs");
  redirect(`/employer/${orgSlug}/settings?saved=logo`);
}

const profileSchema = z.object({
  website_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v.length === 0 || isValidPublicUrl(v),
      "Website must be a full http:// or https:// URL.",
    )
    .transform((v) => (v.length > 0 ? v : null)),
  bio: z
    .string()
    .trim()
    .max(4000, "Bio must be 4000 characters or fewer.")
    .transform((v) => (v.length > 0 ? v : null)),
});

/**
 * Update the organization's public-page metadata (website + bio). Logo is
 * its own form so a single click on "Save logo" or "Save profile" doesn't
 * accidentally clobber unrelated fields.
 */
export async function updateOrgProfile(orgSlug: string, formData: FormData) {
  const { supabase, org } = await requireOrgMember(orgSlug);
  const parsed = profileSchema.safeParse({
    website_url: typeof formData.get("website_url") === "string"
      ? String(formData.get("website_url"))
      : "",
    bio: typeof formData.get("bio") === "string"
      ? String(formData.get("bio"))
      : "",
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid profile.";
    errorRedirect(orgSlug, first);
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      website_url: parsed.data.website_url,
      bio: parsed.data.bio,
    })
    .eq("id", org.id);

  if (error) {
    captureException(error, {
      scope: "employer.update_org_profile",
      org_id: org.id,
    });
    errorRedirect(orgSlug, error.message);
  }

  logEvent("org_profile_updated", { organization_id: org.id });
  revalidatePath(`/employer/${orgSlug}/settings`);
  revalidatePath(`/employers/${orgSlug}`);
  redirect(`/employer/${orgSlug}/settings?saved=profile`);
}

/**
 * Remove the org's logo. Path stored in DB; we delete from storage and clear
 * the column. Storage failure is non-fatal: we still clear the row so the
 * directory stops trying to render a broken image.
 */
export async function deleteOrgLogo(orgSlug: string) {
  const { supabase, org } = await requireOrgMember(orgSlug);

  const { data: existing } = await supabase
    .from("organizations")
    .select("logo_storage_path")
    .eq("id", org.id)
    .maybeSingle();

  const path = (existing as { logo_storage_path: string | null } | null)
    ?.logo_storage_path;

  if (path) {
    await supabase.storage.from("org-logos").remove([path]);
  }

  const { error } = await supabase
    .from("organizations")
    .update({ logo_storage_path: null })
    .eq("id", org.id);

  if (error) {
    errorRedirect(orgSlug, error.message);
  }

  logEvent("org_logo_deleted", { organization_id: org.id });

  revalidatePath(`/employer/${orgSlug}/settings`);
  revalidatePath(`/employers/${orgSlug}`);
  revalidatePath("/jobs");
  redirect(`/employer/${orgSlug}/settings?saved=logo_removed`);
}
