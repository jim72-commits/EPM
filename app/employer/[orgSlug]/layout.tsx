import Image from "next/image";
import Link from "next/link";

import { requireOrgMember } from "@/lib/auth/employer";
import { getOrgLogoUrl } from "@/lib/org-logo-url";

import { EmployerOrgNav } from "./org-nav";

export const dynamic = "force-dynamic";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function EmployerOrgLayout({
  children,
  params,
}: LayoutProps) {
  const { orgSlug } = await params;

  // requireOrgMember handles the redirect if the user isn't signed in or
  // doesn't belong to this org. The outer /employer layout already
  // gatekeeps "is this person an employer at all?", so this only
  // catches "wrong slug" cases.
  const { supabase, org, role } = await requireOrgMember(orgSlug);

  const { data: extra } = await supabase
    .from("organizations")
    .select("logo_storage_path")
    .eq("id", org.id)
    .maybeSingle();
  const logoPath = (extra as { logo_storage_path: string | null } | null)
    ?.logo_storage_path ?? null;
  const logoUrl = getOrgLogoUrl(logoPath);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${org.name} logo`}
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 border border-hairline object-contain"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center border border-hairline bg-surface text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              {org.name.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {org.name}
            </p>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
              {role === "owner" ? "Owner" : "Member"} · /employer/{orgSlug}
            </p>
          </div>
        </div>
        <Link
          href={`/employers/${orgSlug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
        >
          Public page ↗
        </Link>
      </div>
      <div className="mt-6">
        <EmployerOrgNav orgSlug={orgSlug} />
      </div>
      {children}
    </div>
  );
}
