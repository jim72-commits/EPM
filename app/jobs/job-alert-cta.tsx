import Link from "next/link";

import { describeFilters } from "@/lib/alerts/describe-filters";
import { buildJobsUrl } from "@/lib/jobs-url";
import type { JobDirectoryFilters } from "@/lib/types/jobs";

/** Inline CTA under the job list that deep-links to /alerts with filters. */
export function JobAlertCta({ filters }: { filters: JobDirectoryFilters }) {
  const description = describeFilters(filters);
  const alertsQuery = buildJobsUrl(filters).replace(/^\/jobs/, "/alerts");

  return (
    <section className="mt-10 border border-hairline bg-surface p-6">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        Job alerts
      </p>
      <p className="mt-2 text-base text-foreground">
        Get a weekly digest of new roles matching{" "}
        <span className="font-semibold">{description}</span>.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          href={alertsQuery}
          className="inline-flex h-[2.375rem] items-center justify-center border border-transparent bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          Get alerts for this search
        </Link>
        <span className="text-xs text-muted">
          Double opt-in · one-click unsubscribe
        </span>
      </div>
    </section>
  );
}
