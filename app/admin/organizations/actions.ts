"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { friendlyDbError } from "@/lib/db-errors";
import { logEvent } from "@/lib/observability";
import { slugify } from "@/lib/slugify";

const orgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  organization_type: z.enum(["direct", "agency"]),
  country_code: z.enum(["US", "CA"]),
});

const updateOrgSchema = orgSchema.extend({
  id: z.string().uuid(),
  verified: z.boolean(),
});

function encodeOrgFormCarry(params: {
  name: string;
  slug: string;
  organization_type: string;
  country_code: string;
  verified?: boolean;
  error: string;
  basePath: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("error", params.error);
  if (params.name) sp.set("f_name", params.name);
  if (params.slug) sp.set("f_slug", params.slug);
  if (params.organization_type)
    sp.set("f_type", params.organization_type);
  if (params.country_code) sp.set("f_country", params.country_code);
  if (typeof params.verified === "boolean") {
    sp.set("f_verified", params.verified ? "1" : "0");
  }
  return `${params.basePath}?${sp.toString()}`;
}

export async function createOrganization(formData: FormData) {
  const { supabase, user: actor } = await requireAdmin();

  const nameRaw = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const typeRaw = String(formData.get("organization_type") ?? "");
  const countryRaw = String(formData.get("country_code") ?? "");
  const slug = slugRaw.length ? slugRaw : slugify(nameRaw);

  const carry = (error: string) =>
    encodeOrgFormCarry({
      name: nameRaw,
      slug: slugRaw,
      organization_type: typeRaw,
      country_code: countryRaw,
      error,
      basePath: "/admin/organizations/new",
    });

  if (!slug.length) {
    redirect(carry("Could not derive a slug from the name"));
  }

  const parsed = orgSchema.safeParse({
    name: nameRaw,
    slug,
    organization_type: typeRaw,
    country_code: countryRaw,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(carry(msg));
  }

  const { data: inserted, error } = await supabase
    .from("organizations")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    redirect(
      carry(friendlyDbError(error, { context: "organization", slug })),
    );
  }

  logEvent("admin.organization_created", {
    actor_user_id: actor.id,
    organization_id: inserted?.id ?? null,
    name: parsed.data.name,
    slug: parsed.data.slug,
    organization_type: parsed.data.organization_type,
    country_code: parsed.data.country_code,
  });

  revalidatePath("/admin/jobs");
  revalidatePath("/admin/organizations");
  redirect("/admin/organizations?saved=created");
}

export async function updateOrganization(formData: FormData) {
  const { supabase, user: actor } = await requireAdmin();

  const idRaw = String(formData.get("id") ?? "").trim();
  if (!idRaw) {
    redirect(
      `/admin/organizations?error=${encodeURIComponent("Missing organization id")}`,
    );
  }

  const nameRaw = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const typeRaw = String(formData.get("organization_type") ?? "");
  const countryRaw = String(formData.get("country_code") ?? "");
  const verifiedRaw = formData.get("verified") === "on";

  const carry = (error: string) =>
    encodeOrgFormCarry({
      name: nameRaw,
      slug: slugRaw,
      organization_type: typeRaw,
      country_code: countryRaw,
      verified: verifiedRaw,
      error,
      basePath: `/admin/organizations/${idRaw}/edit`,
    });

  const parsed = updateOrgSchema.safeParse({
    id: idRaw,
    name: nameRaw,
    slug: slugRaw,
    organization_type: typeRaw,
    country_code: countryRaw,
    verified: verifiedRaw,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    redirect(carry(msg));
  }

  const { id, name, slug, organization_type, country_code, verified } =
    parsed.data;

  const { data: existing } = await supabase
    .from("organizations")
    .select("name, slug, organization_type, country_code, verified")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    redirect(
      `/admin/organizations?error=${encodeURIComponent("Organization not found")}`,
    );
  }

  // Block slug collisions explicitly. The DB has a unique constraint, but
  // surfacing a friendlier message saves admins from a generic error.
  if (slug !== existing.slug) {
    const { data: collision } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();
    if (collision) {
      redirect(
        carry(`Slug "${slug}" is already used by another organization.`),
      );
    }
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      slug,
      organization_type,
      country_code,
      verified,
    })
    .eq("id", id);

  if (error) {
    redirect(
      carry(friendlyDbError(error, { context: "organization", slug })),
    );
  }

  logEvent("admin.organization_updated", {
    actor_user_id: actor.id,
    organization_id: id,
    changes: diffOrgFields(existing, {
      name,
      slug,
      organization_type,
      country_code,
      verified,
    }),
  });

  // Org renames affect public surfaces in a few places: the directory pages,
  // the public employer profile, and any rendered job page. Revalidate the
  // wide /jobs and /employers trees plus all admin pages we know about.
  revalidatePath("/jobs");
  revalidatePath("/jobs", "layout");
  revalidatePath(`/employers/${existing.slug}`);
  revalidatePath(`/employers/${slug}`);
  revalidatePath("/admin/organizations");
  revalidatePath("/admin/jobs");
  redirect(`/admin/organizations?saved=updated`);
}

type OrgFields = {
  name: string;
  slug: string;
  organization_type: "direct" | "agency";
  country_code: "US" | "CA";
  verified: boolean;
};

type OrgFieldChange = {
  from: string | boolean;
  to: string | boolean;
};

function diffOrgFields(
  before: OrgFields,
  after: OrgFields,
): Record<string, OrgFieldChange> {
  const out: Record<string, OrgFieldChange> = {};
  for (const key of Object.keys(after) as (keyof OrgFields)[]) {
    if (before[key] !== after[key]) {
      out[key] = { from: before[key], to: after[key] };
    }
  }
  return out;
}
