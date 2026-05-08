import type { EmploymentType, RemotePolicy } from "@/lib/types/jobs";

const remoteLabels: Record<RemotePolicy, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  flexible: "Flexible",
};

const employmentLabels: Record<EmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
};

export function formatRemotePolicy(value: RemotePolicy): string {
  return remoteLabels[value];
}

export function formatEmploymentType(value: EmploymentType): string {
  return employmentLabels[value];
}

export function formatCountry(code: "US" | "CA"): string {
  return code === "US" ? "United States" : "Canada";
}

export function formatPublishedDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(d);
}
