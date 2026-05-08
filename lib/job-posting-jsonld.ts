import type { JobDetail } from "@/lib/types/jobs";

const EMPLOYMENT_TYPE_MAP: Record<JobDetail["employment_type"], string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
};

const COUNTRY_NAME_MAP: Record<JobDetail["country_code"], string> = {
  US: "United States",
  CA: "Canada",
};

/**
 * Builds a schema.org JobPosting JSON-LD object for Google Jobs indexing.
 * https://developers.google.com/search/docs/appearance/structured-data/job-posting
 *
 * We only emit this for employer-posted listings with full descriptions —
 * syndicated listings redirect out and would be duplicate content if
 * re-described here.
 */
export function buildJobPostingJsonLd(args: {
  job: JobDetail;
  baseUrl: string;
}): Record<string, unknown> | null {
  const { job, baseUrl } = args;

  if (job.listing_kind !== "employer") return null;
  if (!job.full_description) return null;
  if (!job.published_at) return null;

  const datePosted = job.published_at;
  const validThrough = new Date(
    new Date(datePosted).getTime() + 60 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const jobUrl = `${baseUrl}/jobs/${job.slug}`;
  const countryName = COUNTRY_NAME_MAP[job.country_code];

  const base: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.full_description,
    datePosted,
    validThrough,
    employmentType: EMPLOYMENT_TYPE_MAP[job.employment_type],
    identifier: {
      "@type": "PropertyValue",
      name: "TheCOE",
      value: job.id,
    },
    hiringOrganization: {
      "@type": "Organization",
      name: job.organization.name,
      sameAs: `${baseUrl}/jobs?platform=${job.platform.slug}`,
    },
    url: jobUrl,
    directApply: false,
  };

  const remote = job.remote_policy === "remote";
  const hybridOrOnsite =
    job.remote_policy === "hybrid" || job.remote_policy === "onsite";

  if (remote) {
    base.jobLocationType = "TELECOMMUTE";
    base.applicantLocationRequirements = {
      "@type": "Country",
      name: countryName,
    };
  }

  if (hybridOrOnsite || job.remote_policy === "flexible") {
    base.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: job.country_code,
        ...(job.location_label ? { addressLocality: job.location_label } : {}),
      },
    };
  }

  return base;
}
