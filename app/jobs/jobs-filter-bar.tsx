import { Suspense } from "react";

import { JobsFilterDropdowns } from "@/app/jobs/jobs-filter-dropdowns";
import type { PlatformRow, RoleFamilyRow } from "@/lib/types/jobs";

type Props = {
  platforms: PlatformRow[];
  roleFamilies: RoleFamilyRow[];
};

function FiltersSkeleton() {
  return (
    <div
      className="mt-10 grid gap-8 border-b border-hairline pb-10 sm:grid-cols-2 lg:grid-cols-4"
      aria-hidden
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-[4.25rem] animate-pulse bg-hairline/80" />
      ))}
    </div>
  );
}

export function JobsFilterBar({ platforms, roleFamilies }: Props) {
  return (
    <Suspense fallback={<FiltersSkeleton />}>
      <JobsFilterDropdowns
        platforms={platforms}
        roleFamilies={roleFamilies}
      />
    </Suspense>
  );
}
