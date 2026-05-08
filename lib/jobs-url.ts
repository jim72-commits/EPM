import type { CountryCode, JobDirectoryFilters, RemotePolicy } from "@/lib/types/jobs";

const KEYS: (keyof JobDirectoryFilters)[] = [
  "platform",
  "role",
  "remote",
  "country",
  "q",
];

export function buildJobsUrl(filters: JobDirectoryFilters): string {
  const params = new URLSearchParams();
  if (filters.platform) params.set("platform", filters.platform);
  if (filters.role) params.set("role", filters.role);
  if (filters.remote) params.set("remote", filters.remote);
  if (filters.country) params.set("country", filters.country);
  if (filters.q) params.set("q", filters.q);
  const q = params.toString();
  return q ? `/jobs?${q}` : "/jobs";
}

export function parseJobSearchParams(
  raw: Record<string, string | string[] | undefined>,
): JobDirectoryFilters {
  const platform = pickString(raw.platform);
  const role = pickString(raw.role);
  const remote = pickRemote(raw.remote);
  const country = pickCountry(raw.country);
  const q = pickString(raw.q);
  const out: JobDirectoryFilters = {};
  if (platform) out.platform = platform;
  if (role) out.role = role;
  if (remote) out.remote = remote;
  if (country) out.country = country;
  if (q) out.q = q.slice(0, 120); // keep URLs short, protect tsquery
  return out;
}

export function countActiveFilters(filters: JobDirectoryFilters): number {
  return KEYS.filter((k) => filters[k] != null && filters[k] !== "").length;
}

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function pickRemote(v: string | string[] | undefined): RemotePolicy | undefined {
  const s = pickString(v);
  if (s === "remote" || s === "hybrid" || s === "onsite" || s === "flexible") {
    return s;
  }
  return undefined;
}

function pickCountry(v: string | string[] | undefined): CountryCode | undefined {
  const s = pickString(v);
  if (s === "US" || s === "CA") return s;
  return undefined;
}
