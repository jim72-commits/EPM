import Image from "next/image";
import Link from "next/link";

import { requireOrgMember } from "@/lib/auth/employer";
import { getOrgLogoUrl } from "@/lib/org-logo-url";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";

import { deleteOrgLogo, updateOrgProfile, uploadOrgLogo } from "./actions";
import { LogoUploadForm } from "./logo-upload-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmployerOrgSettings({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug } = await params;
  const { supabase, org } = await requireOrgMember(orgSlug);
  const sp = await searchParams;
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  const error =
    typeof sp.error === "string" ? sp.error : null;

  const { data } = await supabase
    .from("organizations")
    .select("logo_storage_path, website_url, bio")
    .eq("id", org.id)
    .maybeSingle();

  type OrgSettings = {
    logo_storage_path: string | null;
    website_url: string | null;
    bio: string | null;
  };
  const settings = (data as OrgSettings | null) ?? null;
  const logoPath = settings?.logo_storage_path ?? null;
  const websiteUrl = settings?.website_url ?? "";
  const bio = settings?.bio ?? "";
  const logoUrl = getOrgLogoUrl(logoPath);

  const upload = uploadOrgLogo.bind(null, orgSlug);
  const remove = deleteOrgLogo.bind(null, orgSlug);
  const saveProfile = updateOrgProfile.bind(null, orgSlug);

  return (
    <div className="py-6">
      <div className="border-b border-hairline pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-2 text-sm text-muted">
          Brand assets shown on your job listings and on your public
          employer page.
        </p>
      </div>

      {saved === "logo" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Logo updated.
        </p>
      ) : null}
      {saved === "logo_removed" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Logo removed.
        </p>
      ) : null}
      {saved === "profile" ? (
        <p className="mt-6 border border-hairline bg-surface px-4 py-3 text-sm text-foreground">
          Public profile saved.
        </p>
      ) : null}
      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <section className="mt-10 max-w-2xl border border-hairline bg-surface p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Logo
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center border border-hairline bg-background">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`${org.name} logo`}
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                unoptimized
              />
            ) : (
              <span className="text-sm font-semibold tracking-tight text-muted">
                {org.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-foreground">
              {logoUrl ? "Current logo." : "No logo yet."}
            </p>
            <p className="mt-1 text-xs text-muted">
              PNG, JPG, WebP, or SVG. Max 1 MB. Square renders best (we display
              at 64×64). Logos are public — anyone viewing your listings will
              see them.
            </p>
          </div>
        </div>

        <LogoUploadForm action={upload} />

        {logoUrl ? (
          <form action={remove} className="mt-6 border-t border-hairline pt-6">
            <button
              type="submit"
              className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
            >
              Remove logo
            </button>
          </form>
        ) : null}
      </section>

      <section className="mt-10 max-w-2xl border border-hairline bg-surface p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Public profile
        </h2>
        <p className="mt-2 text-sm text-muted">
          Shown on your public page at{" "}
          <Link
            href={`/employers/${orgSlug}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            /employers/{orgSlug}
          </Link>
          .
        </p>

        <form action={saveProfile} className="mt-6 space-y-5">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Website URL
            </span>
            <input
              name="website_url"
              type="url"
              maxLength={500}
              defaultValue={websiteUrl}
              placeholder="https://your-company.com"
              className="mt-2 w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
              Short bio
            </span>
            <textarea
              name="bio"
              rows={6}
              maxLength={4000}
              defaultValue={bio}
              placeholder="A few sentences about your team and how you use Anaplan."
              className="mt-2 w-full border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            />
            <span className="mt-1 block text-[11px] text-muted">
              Plain text, up to 4,000 characters.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.1em] text-on-accent hover:bg-accent-hover"
            >
              Save profile
            </button>
            <Link
              href={`/employers/${orgSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center border border-hairline px-4 text-xs font-medium uppercase tracking-[0.1em] text-muted hover:border-foreground hover:text-foreground"
            >
              Preview public page
            </Link>
          </div>
        </form>
      </section>

      <section className="mt-10 max-w-2xl border border-dashed border-hairline px-5 py-4 text-xs leading-relaxed text-muted">
        <p>
          <strong className="text-foreground">Need to change your company name?</strong>{" "}
          Renaming the organization changes how it&apos;s displayed everywhere
          and is treated as a trust event. Email{" "}
          <a
            href={SUPPORT_MAILTO}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          and we&apos;ll handle it within one business day.
        </p>
      </section>
    </div>
  );
}
