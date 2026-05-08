import type {
  JobDetail,
  JobListItem,
  PlatformRow,
  RoleFamilyRow,
} from "@/lib/types/jobs";

/** Mirrors seed data in supabase/migrations for local dev without a Supabase project. */
export const MOCK_PLATFORMS: PlatformRow[] = [
  {
    id: "p-anaplan",
    slug: "anaplan",
    name: "Anaplan",
    sort_order: 10,
    is_active: true,
  },
  {
    id: "p-pigment",
    slug: "pigment",
    name: "Pigment",
    sort_order: 20,
    is_active: false,
  },
  {
    id: "p-onestream",
    slug: "onestream",
    name: "OneStream",
    sort_order: 30,
    is_active: false,
  },
  {
    id: "p-adaptive",
    slug: "workday-adaptive",
    name: "Workday Adaptive Planning",
    sort_order: 40,
    is_active: false,
  },
  {
    id: "p-tagetik",
    slug: "tagetik",
    name: "Tagetik",
    sort_order: 50,
    is_active: false,
  },
  {
    id: "p-cube",
    slug: "cube",
    name: "Cube",
    sort_order: 60,
    is_active: false,
  },
];

export const MOCK_ROLE_FAMILIES: RoleFamilyRow[] = [
  { id: "r-mb", slug: "model-builder", name: "Model builder", sort_order: 10 },
  {
    id: "r-sa",
    slug: "solution-architect",
    name: "Solution architect",
    sort_order: 20,
  },
  {
    id: "r-ba",
    slug: "business-analyst",
    name: "Business analyst",
    sort_order: 30,
  },
  {
    id: "r-pm",
    slug: "project-manager",
    name: "Project manager",
    sort_order: 40,
  },
  {
    id: "r-admin",
    slug: "platform-admin",
    name: "Platform admin",
    sort_order: 50,
  },
];

const MOCK_ORG = {
  name: "Demo Corp NA",
  slug: "demo-corp-na",
  logo_storage_path: null,
};

const MOCK_JOBS: JobDetail[] = [
  {
    id: "mock-1",
    slug: "anaplan-senior-model-builder-remote-us",
    title: "Senior Anaplan Model Builder",
    listing_kind: "employer",
    remote_policy: "remote",
    employment_type: "full_time",
    country_code: "US",
    location_label: "Remote — United States",
    published_at: new Date().toISOString(),
    is_featured: true,
    organization: MOCK_ORG,
    platform: { name: "Anaplan", slug: "anaplan" },
    role_family: { name: "Model builder", slug: "model-builder" },
    summary: null,
    full_description:
      "## Role\n\nOwn core planning models in Anaplan for US FP&A.\n\n## You\n\n- Multi-year Anaplan experience\n- Strong communication with finance stakeholders\n",
    external_apply_url: null,
  },
  {
    id: "mock-2",
    slug: "anaplan-solution-architect-toronto",
    title: "Anaplan Solution Architect",
    listing_kind: "employer",
    remote_policy: "hybrid",
    employment_type: "full_time",
    country_code: "CA",
    location_label: "Toronto, ON (hybrid)",
    published_at: new Date().toISOString(),
    is_featured: false,
    organization: MOCK_ORG,
    platform: { name: "Anaplan", slug: "anaplan" },
    role_family: { name: "Solution architect", slug: "solution-architect" },
    summary: null,
    full_description:
      "## Role\n\nLead Anaplan deployments for Canadian enterprise customers. Partner with finance, sales, and supply-chain leaders to translate requirements into robust models.\n\n## You\n\n- 5+ years hands-on Anaplan\n- Model-to-production ownership\n- Comfortable presenting to VP and C-level stakeholders\n",
    external_apply_url: null,
  },
  {
    id: "mock-3",
    slug: "anaplan-certified-master-anaplanner-chicago",
    title: "Certified Master Anaplanner",
    listing_kind: "syndicated",
    remote_policy: "hybrid",
    employment_type: "full_time",
    country_code: "US",
    location_label: "Chicago, IL",
    published_at: new Date().toISOString(),
    is_featured: false,
    organization: MOCK_ORG,
    platform: { name: "Anaplan", slug: "anaplan" },
    role_family: { name: "Model builder", slug: "model-builder" },
    summary:
      "Own FP&A Anaplan models end-to-end for a Fortune 500 retailer. Full description and application on the employer site.",
    full_description: null,
    external_apply_url: "https://example.com/apply/anaplan-cma",
  },
];

function matchesFilters(
  job: JobDetail,
  filters: {
    platform?: string;
    role?: string;
    remote?: JobDetail["remote_policy"];
    country?: JobDetail["country_code"];
    q?: string;
  },
): boolean {
  if (filters.platform && job.platform.slug !== filters.platform) {
    return false;
  }
  if (filters.role && job.role_family.slug !== filters.role) {
    return false;
  }
  if (filters.remote && job.remote_policy !== filters.remote) {
    return false;
  }
  if (filters.country && job.country_code !== filters.country) {
    return false;
  }
  if (filters.q) {
    const haystack = [
      job.title,
      job.summary ?? "",
      job.full_description ?? "",
      job.location_label ?? "",
    ]
      .join(" ")
      .toLowerCase();
    const needles = filters.q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!needles.every((n) => haystack.includes(n))) return false;
  }
  return true;
}

export function getMockTaxonomy(options?: { includeInactive?: boolean }): {
  platforms: PlatformRow[];
  role_families: RoleFamilyRow[];
} {
  const platforms = [...MOCK_PLATFORMS]
    .filter((p) => (options?.includeInactive ? true : p.is_active))
    .sort((a, b) => a.sort_order - b.sort_order);
  return {
    platforms,
    role_families: [...MOCK_ROLE_FAMILIES].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  };
}

function isActivePlatformSlug(slug: string): boolean {
  return MOCK_PLATFORMS.find((p) => p.slug === slug)?.is_active ?? false;
}

export function getMockOpenJobs(filters: {
  platform?: string;
  role?: string;
  remote?: JobDetail["remote_policy"];
  country?: JobDetail["country_code"];
  q?: string;
}): JobListItem[] {
  return MOCK_JOBS.filter(
    (j) => isActivePlatformSlug(j.platform.slug) && matchesFilters(j, filters),
  ).map(toListItem);
}

export function getMockJobBySlug(slug: string): JobDetail | null {
  const job = MOCK_JOBS.find((j) => j.slug === slug);
  if (!job) return null;
  if (!isActivePlatformSlug(job.platform.slug)) return null;
  return job;
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
