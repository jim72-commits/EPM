import type { JobDirectoryFilters } from "@/lib/types/jobs";

/** Renders a human-readable description of a filter set for UI and emails. */
export function describeFilters(filters: JobDirectoryFilters): string {
  const parts: string[] = [];

  if (filters.platform) parts.push(titleCase(filters.platform));
  if (filters.role) parts.push(humanizeRole(filters.role));
  if (filters.remote) parts.push(remoteLabel(filters.remote));
  if (filters.country) parts.push(countryLabel(filters.country));
  if (filters.q) parts.push(`"${filters.q}"`);

  if (parts.length === 0) return "all new open Anaplan roles";
  return parts.join(" · ");
}

function titleCase(slug: string): string {
  return slug
    .split(/[-\s]/)
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

function humanizeRole(slug: string): string {
  return titleCase(slug);
}

function remoteLabel(value: string): string {
  switch (value) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
      return "On-site";
    case "flexible":
      return "Flexible";
    default:
      return value;
  }
}

function countryLabel(value: string): string {
  if (value === "US") return "United States";
  if (value === "CA") return "Canada";
  return value;
}
