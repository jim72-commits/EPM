import Link from "next/link";
import { notFound } from "next/navigation";

import { updateOrganization } from "@/app/admin/organizations/actions";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const inputClass =
  "mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

function readStr(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

export default async function AdminEditOrgPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const error =
    typeof sp.error === "string" ? sp.error : undefined;

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, organization_type, country_code, verified, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  // After a failed submit the action redirects back here with the user's
  // typed values in f_* params. Prefer those over the persisted row so
  // admins don't lose typing on a slug-collision or validation error.
  const fName = readStr(sp, "f_name");
  const fSlug = readStr(sp, "f_slug");
  const fTypeRaw = readStr(sp, "f_type");
  const fType: "direct" | "agency" =
    fTypeRaw === "agency" || fTypeRaw === "direct"
      ? fTypeRaw
      : (org.organization_type as "direct" | "agency");
  const fCountryRaw = readStr(sp, "f_country");
  const fCountry: "US" | "CA" =
    fCountryRaw === "CA" || fCountryRaw === "US"
      ? fCountryRaw
      : (org.country_code as "US" | "CA");
  const fVerifiedRaw = readStr(sp, "f_verified");
  const fVerified =
    fVerifiedRaw === "1" || fVerifiedRaw === "0"
      ? fVerifiedRaw === "1"
      : Boolean(org.verified);

  return (
    <div className="py-6">
      <div className="border-b border-hairline pb-6">
        <Link
          href="/admin/organizations"
          className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
        >
          ← All organizations
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Edit · {org.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Renaming an organization changes the public profile and every job
          listing&apos;s employer label. Changing the slug also breaks any
          existing public links — use sparingly.
        </p>
      </div>

      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <form
        action={updateOrganization}
        className="mx-auto max-w-lg space-y-6 py-10"
      >
        <input type="hidden" name="id" value={org.id} />

        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={fName ?? org.name}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            required
            defaultValue={fSlug ?? org.slug}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className={inputClass}
          />
          <p className="mt-2 text-xs text-muted">
            Used in URLs:{" "}
            <code className="font-mono">/employers/{org.slug}</code>. Lowercase,
            numbers, hyphens.
          </p>
        </div>

        <div>
          <label htmlFor="organization_type" className={labelClass}>
            Type
          </label>
          <select
            id="organization_type"
            name="organization_type"
            required
            defaultValue={fType}
            className={inputClass}
          >
            <option value="direct">Direct employer</option>
            <option value="agency">Agency / partner</option>
          </select>
        </div>

        <div>
          <label htmlFor="country_code" className={labelClass}>
            Country
          </label>
          <select
            id="country_code"
            name="country_code"
            required
            defaultValue={fCountry}
            className={inputClass}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </div>

        <label className="flex items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            name="verified"
            defaultChecked={fVerified}
            className="mt-0.5 h-4 w-4 border-hairline"
          />
          <span>
            Verified employer
            <span className="block text-xs text-muted">
              Toggles the trust badge on the public profile and in search.
              Only flip this after you&apos;ve confirmed the company is real
              and authorized to post.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
          >
            Save changes
          </button>
          <Link
            href="/admin/organizations"
            className="inline-flex h-11 items-center justify-center border border-hairline bg-surface px-6 text-xs font-medium uppercase tracking-[0.12em] text-muted hover:border-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
