"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  key: string;
  href: string;
  label: string;
  /** Path prefix that should highlight this tab when active. */
  match: (pathname: string) => boolean;
};

type Props = {
  orgSlug: string;
};

/**
 * Org-scoped tabs (Jobs / Team / Settings). The "active" calculation is
 * client-side because Next's server components don't see the live URL —
 * `usePathname` here gives us a tiny client island just for the
 * highlight, while the links themselves remain plain anchors.
 */
export function EmployerOrgNav({ orgSlug }: Props) {
  const pathname = usePathname() ?? "";

  const tabs: Tab[] = [
    {
      key: "jobs",
      href: `/employer/${orgSlug}/jobs`,
      label: "Jobs",
      // The job-form pages live under /jobs/new and /jobs/[id]/... so the
      // entire /jobs subtree should keep this tab active.
      match: (p) => p.startsWith(`/employer/${orgSlug}/jobs`),
    },
    {
      key: "team",
      href: `/employer/${orgSlug}/members`,
      label: "Team",
      match: (p) => p.startsWith(`/employer/${orgSlug}/members`),
    },
    {
      key: "settings",
      href: `/employer/${orgSlug}/settings`,
      label: "Settings",
      match: (p) => p.startsWith(`/employer/${orgSlug}/settings`),
    },
  ];

  return (
    <nav className="flex flex-wrap gap-1 border-b border-hairline">
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
