import {
  getMockJobBySlug,
  getMockOpenJobs,
  getMockTaxonomy,
} from "@/lib/dev-mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  CountryCode,
  JobDetail,
  JobDirectoryFilters,
  JobListItem,
  PlatformRow,
  RemotePolicy,
  RoleFamilyRow,
} from "@/lib/types/jobs";

type Rel<T> = T | T[] | null;

type SupabaseJobRow = {
  id: string;
  slug: string;
  title: string;
  listing_kind: JobDetail["listing_kind"];
  remote_policy: JobDetail["remote_policy"];
  employment_type: JobDetail["employment_type"];
  country_code: JobDetail["country_code"];
  location_label: string | null;
  published_at: string | null;
  summary: string | null;
  full_description: string | null;
  external_apply_url: string | null;
  is_featured: boolean | null;
  featured_until: string | null;
  organizations: Rel<{
    name: string;
    slug: string;
    logo_storage_path: string | null;
  }>;
  platforms: Rel<{ name: string; slug: string; is_active?: boolean }>;
  role_families: Rel<{ name: string; slug: string }>;
};

export async function getTaxonomy(options?: { includeInactive?: boolean }): Promise<{
  platforms: PlatformRow[];
  role_families: RoleFamilyRow[];
}> {
  const includeInactive = options?.includeInactive ?? false;

  if (!isSupabaseConfigured()) {
    return getMockTaxonomy({ includeInactive });
  }

  const supabase = await createServerSupabaseClient();
  let platformsQuery = supabase
    .from("platforms")
    .select("*")
    .order("sort_order", { ascending: true });
  if (!includeInactive) {
    platformsQuery = platformsQuery.eq("is_active", true);
  }

  const [pl, rf] = await Promise.all([
    platformsQuery,
    supabase
      .from("role_families")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  if (pl.error || rf.error) {
    console.error(pl.error ?? rf.error);
    return getMockTaxonomy({ includeInactive });
  }

  return {
    platforms: (pl.data ?? []) as PlatformRow[],
    role_families: (rf.data ?? []) as RoleFamilyRow[],
  };
}

export async function getOpenJobs(
  filters: JobDirectoryFilters,
): Promise<JobListItem[]> {
  if (!isSupabaseConfigured()) {
    return getMockOpenJobs({
      platform: filters.platform,
      role: filters.role,
      remote: filters.remote as RemotePolicy | undefined,
      country: filters.country as CountryCode | undefined,
      q: filters.q,
    });
  }

  const supabase = await createServerSupabaseClient();
  // Inner-join platforms and gate by is_active so inactive platforms never
  // surface publicly, even if an admin previously created jobs for them.
  let query = supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        listing_kind,
        remote_policy,
        employment_type,
        country_code,
        location_label,
        published_at,
        summary,
        full_description,
        external_apply_url,
        is_featured,
        featured_until,
        organizations ( name, slug, logo_storage_path ),
        platforms!inner ( name, slug, is_active ),
        role_families ( name, slug )
      `,
    )
    .eq("status", "open")
    .eq("platforms.is_active", true)
    // Active-featured listings float to the top, then ordinary listings by
    // recency. We compute "active featured" in mapping (post-fetch) since
    // PostgREST can't express the OR-with-now() condition cleanly here, but
    // the index on (is_featured, featured_until) keeps the read path fast.
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false });

  if (filters.platform) {
    const { data: p } = await supabase
      .from("platforms")
      .select("id")
      .eq("slug", filters.platform)
      .maybeSingle();
    if (p?.id) query = query.eq("primary_platform_id", p.id);
    else return [];
  }

  if (filters.role) {
    const { data: r } = await supabase
      .from("role_families")
      .select("id")
      .eq("slug", filters.role)
      .maybeSingle();
    if (r?.id) query = query.eq("role_family_id", r.id);
    else return [];
  }

  if (filters.remote) {
    query = query.eq("remote_policy", filters.remote);
  }

  if (filters.country) {
    query = query.eq("country_code", filters.country);
  }

  if (filters.q) {
    // websearch_to_tsquery accepts natural phrasing ("model builder remote")
    // and handles quoted phrases / OR / -exclusion like a search engine.
    query = query.textSearch("search_vector", filters.q, {
      type: "websearch",
      config: "english",
    });
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? [])
    .map((row) => mapSupabaseJobToDetail(row as SupabaseJobRow))
    .filter((j): j is JobDetail => j !== null)
    .map(toListItem);
}

export async function getJobBySlug(slug: string): Promise<JobDetail | null> {
  if (!isSupabaseConfigured()) {
    return getMockJobBySlug(slug);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
        id,
        slug,
        title,
        listing_kind,
        remote_policy,
        employment_type,
        country_code,
        location_label,
        published_at,
        summary,
        full_description,
        external_apply_url,
        is_featured,
        featured_until,
        organizations ( name, slug, logo_storage_path ),
        platforms!inner ( name, slug, is_active ),
        role_families ( name, slug )
      `,
    )
    .eq("slug", slug)
    .eq("status", "open")
    .eq("platforms.is_active", true)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  if (!data) return null;
  return mapSupabaseJobToDetail(data as SupabaseJobRow);
}

function mapSupabaseJobToDetail(row: SupabaseJobRow): JobDetail | null {
  const org = firstRelation(row.organizations);
  const platform = firstRelation(row.platforms);
  const roleFamily = firstRelation(row.role_families);
  if (!org || !platform || !roleFamily) return null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    listing_kind: row.listing_kind,
    remote_policy: row.remote_policy,
    employment_type: row.employment_type,
    country_code: row.country_code,
    location_label: row.location_label,
    published_at: row.published_at,
    is_featured: isActivelyFeatured(row.is_featured, row.featured_until),
    organization: {
      name: org.name,
      slug: org.slug,
      logo_storage_path: org.logo_storage_path ?? null,
    },
    platform: { name: platform.name, slug: platform.slug },
    role_family: { name: roleFamily.name, slug: roleFamily.slug },
    summary: row.summary,
    full_description: row.full_description,
    external_apply_url: row.external_apply_url,
  };
}

/**
 * "Actively featured" means the row is flagged AND either has no end date or
 * the end date is in the future. We do this client-side rather than in the
 * SQL filter so an admin's expired promo silently demotes without an admin
 * action; the index still ensures the (is_featured = true) sort prefix is
 * cheap.
 */
function isActivelyFeatured(
  flag: boolean | null,
  until: string | null,
): boolean {
  if (!flag) return false;
  if (until === null) return true;
  const ends = Date.parse(until);
  if (Number.isNaN(ends)) return true;
  return ends > Date.now();
}

function firstRelation<T>(value: Rel<T>): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toListItem(j: JobDetail): JobListItem {
  return {
    id: j.id,
    slug: j.slug,
    title: j.title,
    listing_kind: j.listing_kind,
    remote_policy: j.remote_policy,
    employment_type: j.employment_type,
    country_code: j.country_code,
    location_label: j.location_label,
    published_at: j.published_at,
    is_featured: j.is_featured,
    organization: j.organization,
    platform: j.platform,
    role_family: j.role_family,
  };
}
