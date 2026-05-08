import Link from "next/link";

import { createOrganization } from "@/app/admin/organizations/actions";

export const metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readStr(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return typeof v === "string" ? v : undefined;
}

export default async function AdminNewOrganizationPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const error =
    typeof sp.error === "string" ? sp.error : undefined;
  // Round-trip the form fields through the URL so a validation/db error
  // doesn't lose the admin's typed input. f_* prefix keeps the keys obvious.
  const fName = readStr(sp, "f_name");
  const fSlug = readStr(sp, "f_slug");
  const fType =
    readStr(sp, "f_type") === "agency" ? "agency" : "direct";
  const fCountry = readStr(sp, "f_country") === "CA" ? "CA" : "US";

  return (
    <div>
      <div className="border-b border-hairline py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New organization
        </h1>
        <p className="mt-2 text-sm text-muted">
          Slug is used in URLs; leave blank to derive from the name.
        </p>
      </div>

      {error ? (
        <p className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <form action={createOrganization} className="mx-auto max-w-lg space-y-6 py-10">
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={fName ?? ""}
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>
        <div>
          <label
            htmlFor="slug"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Slug (optional)
          </label>
          <input
            id="slug"
            name="slug"
            defaultValue={fSlug ?? ""}
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>
        <div>
          <label
            htmlFor="organization_type"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Type
          </label>
          <select
            id="organization_type"
            name="organization_type"
            required
            defaultValue={fType}
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <option value="direct">Direct employer</option>
            <option value="agency">Agency / partner</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="country_code"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Country
          </label>
          <select
            id="country_code"
            name="country_code"
            required
            defaultValue={fCountry}
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
          >
            Create
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
