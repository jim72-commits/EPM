"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useMemo } from "react";

import { buildJobsUrl, countActiveFilters } from "@/lib/jobs-url";
import type {
  CountryCode,
  JobDirectoryFilters,
  PlatformRow,
  RemotePolicy,
  RoleFamilyRow,
} from "@/lib/types/jobs";

const REMOTE_VALUES: RemotePolicy[] = [
  "remote",
  "hybrid",
  "onsite",
  "flexible",
];

const REMOTE_LABELS: Record<RemotePolicy, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  flexible: "Flexible",
};

const COUNTRY_OPTIONS: { value: CountryCode; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
];

const labelClass =
  "block text-xs font-medium uppercase tracking-[0.12em] text-muted";
const selectClass =
  "mt-2 w-full max-w-xs border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

type Props = {
  platforms: PlatformRow[];
  roleFamilies: RoleFamilyRow[];
};

export function JobsFilterDropdowns({ platforms, roleFamilies }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hide the platform dropdown when only one platform is active — a single
  // option is noise. We still honor the platform query param for future
  // multi-platform expansion without URL breakage.
  const showPlatformFilter = platforms.length > 1;

  const active = useMemo(
    (): JobDirectoryFilters => ({
      platform: searchParams.get("platform")?.trim() || undefined,
      role: searchParams.get("role")?.trim() || undefined,
      remote: parseRemote(searchParams.get("remote")),
      country: parseCountry(searchParams.get("country")),
      q: searchParams.get("q")?.trim() || undefined,
    }),
    [searchParams],
  );

  const activeCount = countActiveFilters(active);

  const navigate = useCallback(
    (
      patch: Partial<
        Record<"platform" | "role" | "remote" | "country" | "q", string>
      >,
    ) => {
      const next: JobDirectoryFilters = {};

      const platform =
        patch.platform !== undefined
          ? patch.platform.trim() || undefined
          : active.platform;
      const role =
        patch.role !== undefined
          ? patch.role.trim() || undefined
          : active.role;
      const remoteRaw =
        patch.remote !== undefined
          ? patch.remote.trim() || undefined
          : active.remote;
      const countryRaw =
        patch.country !== undefined
          ? patch.country.trim() || undefined
          : active.country;
      const q =
        patch.q !== undefined ? patch.q.trim() || undefined : active.q;

      if (platform) next.platform = platform;
      if (role) next.role = role;
      const remote = parseRemote(remoteRaw ?? null);
      if (remote) next.remote = remote;
      const country = parseCountry(countryRaw ?? null);
      if (country) next.country = country;
      if (q) next.q = q.slice(0, 120);

      router.push(buildJobsUrl(next), { scroll: false });
    },
    [active, router],
  );

  const onSearchSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const q = (formData.get("q") ?? "").toString();
      navigate({ q });
    },
    [navigate],
  );

  return (
    <section
      className="mt-10 space-y-8 border-b border-hairline pb-10"
      aria-label="Filters"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Refine
          </p>
          <p className="mt-1 text-sm text-muted">
            Leave each dropdown on “All” to show every open role. Filters update
            the URL for sharing.
            {activeCount > 0 ? (
              <span className="ml-1 text-foreground">
                {activeCount} active
              </span>
            ) : null}
          </p>
        </div>
        {activeCount > 0 ? (
          <Link
            href="/jobs"
            className="text-xs font-medium uppercase tracking-[0.12em] text-accent hover:text-accent-hover"
            scroll={false}
          >
            Clear all
          </Link>
        ) : null}
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="flex flex-wrap items-end gap-3"
        // Re-mount the uncontrolled input whenever the URL query changes so
        // external navigation (Clear all, back/forward) keeps the field in sync.
        key={active.q ?? ""}
      >
        <div className="flex-1 min-w-[16rem]">
          <label htmlFor="filter-q" className={labelClass}>
            Search
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            inputMode="search"
            placeholder="model builder remote Toronto certified master anaplanner"
            defaultValue={active.q ?? ""}
            maxLength={120}
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-[2.375rem] items-center justify-center border border-transparent bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          Search
        </button>
        {active.q ? (
          <button
            type="button"
            onClick={() => navigate({ q: "" })}
            className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
          >
            Clear search
          </button>
        ) : null}
      </form>

      <div
        className={
          showPlatformFilter
            ? "grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {showPlatformFilter ? (
          <div>
            <label htmlFor="filter-platform" className={labelClass}>
              Platform
            </label>
            <select
              id="filter-platform"
              className={selectClass}
              value={active.platform ?? ""}
              onChange={(e) => navigate({ platform: e.target.value })}
            >
              <option value="">All platforms</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="filter-role" className={labelClass}>
            Role family
          </label>
          <select
            id="filter-role"
            className={selectClass}
            value={active.role ?? ""}
            onChange={(e) => navigate({ role: e.target.value })}
          >
            <option value="">All roles</option>
            {roleFamilies.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-remote" className={labelClass}>
            Remote policy
          </label>
          <select
            id="filter-remote"
            className={selectClass}
            value={active.remote ?? ""}
            onChange={(e) => navigate({ remote: e.target.value })}
          >
            <option value="">All policies</option>
            {REMOTE_VALUES.map((v) => (
              <option key={v} value={v}>
                {REMOTE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-country" className={labelClass}>
            Country
          </label>
          <select
            id="filter-country"
            className={selectClass}
            value={active.country ?? ""}
            onChange={(e) => navigate({ country: e.target.value })}
          >
            <option value="">All countries</option>
            {COUNTRY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

function parseRemote(v: string | null): RemotePolicy | undefined {
  if (!v?.trim()) return undefined;
  if (REMOTE_VALUES.includes(v as RemotePolicy)) return v as RemotePolicy;
  return undefined;
}

function parseCountry(v: string | null): CountryCode | undefined {
  if (!v?.trim()) return undefined;
  if (v === "US" || v === "CA") return v;
  return undefined;
}
