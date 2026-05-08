"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCandidate } from "@/lib/auth/candidate";
import { friendlyDbError } from "@/lib/db-errors";
import { isValidPublicUrl } from "@/lib/url";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_RESUME_TYPES = new Set(["application/pdf"]);

function errorRedirect(message: string): never {
  redirect(`/me/profile?error=${encodeURIComponent(message)}`);
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

const profileSchema = z.object({
  full_name: z.string().min(1).max(200),
  headline: z.string().max(200).nullable(),
  country_code: z.enum(["US", "CA"]),
  location_label: z.string().max(200).nullable(),
  work_auth_us: z.enum([
    "citizen",
    "permanent_resident",
    "visa_required",
    "none",
  ]),
  work_auth_ca: z.enum([
    "citizen",
    "permanent_resident",
    "visa_required",
    "none",
  ]),
  years_experience_anaplan: z.coerce.number().int().min(0).max(40),
  open_to_remote: z.boolean(),
  open_to_hybrid: z.boolean(),
  open_to_onsite: z.boolean(),
  linkedin_url: z
    .string()
    .max(500)
    .nullable()
    .refine(
      (v) => v === null || isValidPublicUrl(v),
      "LinkedIn must be a full http:// or https:// URL.",
    ),
  portfolio_url: z
    .string()
    .max(500)
    .nullable()
    .refine(
      (v) => v === null || isValidPublicUrl(v),
      "Portfolio must be a full http:// or https:// URL.",
    ),
  bio: z.string().max(8000).nullable(),
});

export async function updateCandidateProfile(formData: FormData) {
  const { user, supabase } = await requireCandidate();

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    headline: emptyToNull(formData.get("headline")),
    country_code: formData.get("country_code"),
    location_label: emptyToNull(formData.get("location_label")),
    work_auth_us: formData.get("work_auth_us"),
    work_auth_ca: formData.get("work_auth_ca"),
    years_experience_anaplan: formData.get("years_experience_anaplan"),
    open_to_remote: formData.get("open_to_remote") === "on",
    open_to_hybrid: formData.get("open_to_hybrid") === "on",
    open_to_onsite: formData.get("open_to_onsite") === "on",
    linkedin_url: emptyToNull(formData.get("linkedin_url")),
    portfolio_url: emptyToNull(formData.get("portfolio_url")),
    bio: emptyToNull(formData.get("bio")),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Check all fields";
    errorRedirect(msg);
  }

  const { error } = await supabase
    .from("candidate_profiles")
    .update(parsed.data)
    .eq("user_id", user.id);

  if (error) {
    errorRedirect(friendlyDbError(error, { context: "profile" }));
  }

  revalidatePath("/me/profile");
  redirect("/me/profile?saved=1");
}

export async function uploadResume(formData: FormData) {
  const { user, profile, supabase } = await requireCandidate();

  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    errorRedirect("Pick a PDF file to upload.");
  }
  if (file.size > MAX_RESUME_BYTES) {
    errorRedirect("Resume must be under 5 MB.");
  }
  if (!ALLOWED_RESUME_TYPES.has(file.type)) {
    errorRedirect("Resume must be a PDF.");
  }

  const key = `${user.id}/${crypto.randomUUID()}.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("candidate-resumes")
    .upload(key, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    // Storage errors aren't Postgres errors, so we use a static fallback.
    // Surface only the user-actionable message: storage quota / wrong type.
    errorRedirect(
      uploadError.message.toLowerCase().includes("size")
        ? "Resume is too large. Try a smaller PDF."
        : "Couldn't upload that file. Try again, or pick a different PDF.",
    );
  }

  const previousPath = profile.resume_path;

  // Commit the DB row before removing the old file. If the update fails we
  // can still roll back by deleting the just-uploaded file, leaving the
  // candidate's existing resume intact. Removing the old file first would
  // leave the user with a dangling pointer or no resume at all on failure.
  const { error: updateError } = await supabase
    .from("candidate_profiles")
    .update({
      resume_path: key,
      resume_uploaded_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    await supabase.storage.from("candidate-resumes").remove([key]);
    errorRedirect(friendlyDbError(updateError, { context: "profile" }));
  }

  if (previousPath) {
    // Best-effort cleanup; if it fails we leak a single object but the
    // user's profile is in a consistent state.
    await supabase.storage.from("candidate-resumes").remove([previousPath]);
  }

  revalidatePath("/me/profile");
  redirect("/me/profile?saved=resume");
}

/**
 * Single-checkbox toggle for the weekly profile-match digest. Lives on its
 * own form so the user can change it without re-submitting the whole
 * profile form.
 */
export async function setDigestOptIn(formData: FormData) {
  const { user, supabase } = await requireCandidate();
  const optIn = formData.get("digest_opt_in") === "on";

  const { error } = await supabase
    .from("candidate_profiles")
    .update({ digest_opt_in: optIn })
    .eq("user_id", user.id);

  if (error) {
    errorRedirect(friendlyDbError(error, { context: "profile" }));
  }

  revalidatePath("/me/profile");
  redirect(`/me/profile?saved=${optIn ? "digest_on" : "digest_off"}`);
}

export async function deleteResume() {
  const { user, profile, supabase } = await requireCandidate();

  // Clear the DB row first so the candidate's profile reflects the change
  // even if the storage delete fails (which we tolerate as a leaked object,
  // not a broken state).
  const { error: updateError } = await supabase
    .from("candidate_profiles")
    .update({ resume_path: null, resume_uploaded_at: null })
    .eq("user_id", user.id);

  if (updateError) {
    errorRedirect(friendlyDbError(updateError, { context: "profile" }));
  }

  if (profile.resume_path) {
    await supabase.storage
      .from("candidate-resumes")
      .remove([profile.resume_path]);
  }

  revalidatePath("/me/profile");
  redirect("/me/profile?saved=resume_deleted");
}

const credentialSchema = z
  .object({
    credential_type: z.enum(["certification", "role_history", "education"]),
    title: z.string().min(1).max(250),
    organization_name: z.string().max(250).nullable(),
    start_date: z
      .string()
      .nullable()
      .refine(
        (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "Dates must be YYYY-MM-DD",
      ),
    end_date: z
      .string()
      .nullable()
      .refine(
        (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
        "Dates must be YYYY-MM-DD",
      ),
    description: z.string().max(2000).nullable(),
  })
  .refine(
    (v) =>
      v.start_date === null || v.end_date === null || v.start_date <= v.end_date,
    { message: "End date must be after start date" },
  );

export async function addCredential(formData: FormData) {
  const { user, supabase } = await requireCandidate();

  const parsed = credentialSchema.safeParse({
    credential_type: formData.get("credential_type"),
    title: formData.get("title"),
    organization_name: emptyToNull(formData.get("organization_name")),
    start_date: emptyToNull(formData.get("start_date")),
    end_date: emptyToNull(formData.get("end_date")),
    description: emptyToNull(formData.get("description")),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Check all fields";
    errorRedirect(msg);
  }

  const { error } = await supabase.from("candidate_credentials").insert({
    user_id: user.id,
    ...parsed.data,
  });

  if (error) {
    errorRedirect(friendlyDbError(error, { context: "profile" }));
  }

  revalidatePath("/me/profile");
  redirect("/me/profile?saved=credential");
}

export async function deleteCredential(formData: FormData) {
  const { user, supabase } = await requireCandidate();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) errorRedirect("Invalid credential id");

  const { error } = await supabase
    .from("candidate_credentials")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    errorRedirect(friendlyDbError(error, { context: "profile" }));
  }

  revalidatePath("/me/profile");
  redirect("/me/profile?saved=credential_deleted");
}
