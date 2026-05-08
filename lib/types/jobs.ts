/**
 * `employer`   — listing posted directly on TheCOE by the hiring company,
 *                with a full description rendered in-product. (Was `paid`
 *                under the old per-post fee model; renamed when the site
 *                moved to a free + ad-supported business model.)
 * `syndicated` — aggregated listing that links out to an employer-owned
 *                application URL; we only host a short summary so we don't
 *                duplicate the canonical description.
 */
export type ListingKind = "employer" | "syndicated";

export type RemotePolicy = "remote" | "hybrid" | "onsite" | "flexible";

export type EmploymentType = "full_time" | "part_time" | "contract";

export type CountryCode = "US" | "CA";

export type PlatformRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type RoleFamilyRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
};

export type JobListItem = {
  id: string;
  slug: string;
  title: string;
  listing_kind: ListingKind;
  remote_policy: RemotePolicy;
  employment_type: EmploymentType;
  country_code: CountryCode;
  location_label: string | null;
  published_at: string | null;
  is_featured: boolean;
  organization: {
    name: string;
    slug: string;
    logo_storage_path: string | null;
  };
  platform: { name: string; slug: string };
  role_family: { name: string; slug: string };
};

export type JobDetail = JobListItem & {
  summary: string | null;
  full_description: string | null;
  external_apply_url: string | null;
};

export type JobDirectoryFilters = {
  platform?: string;
  role?: string;
  remote?: RemotePolicy;
  country?: CountryCode;
  q?: string;
};
