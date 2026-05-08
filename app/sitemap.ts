import type { MetadataRoute } from "next";

import { getAppBaseUrl } from "@/lib/app-url";
import { getOpenJobs } from "@/lib/jobs-queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppBaseUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/jobs`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/post`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.1 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.1 },
  ];

  // Include open listings so Google can crawl every role. Errors (missing
  // Supabase env, network) degrade gracefully to just the static routes.
  let jobRoutes: MetadataRoute.Sitemap = [];
  try {
    const jobs = await getOpenJobs({});
    jobRoutes = jobs.map((job) => ({
      url: `${base}/jobs/${job.slug}`,
      lastModified: job.published_at ? new Date(job.published_at) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch (error) {
    console.error("sitemap: failed to load jobs", error);
  }

  return [...staticRoutes, ...jobRoutes];
}
