import Link from "next/link";

import { Logo } from "@/components/logo/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { getOptionalAuth } from "@/lib/auth/admin";

const navLinkClass =
  "text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground transition-colors duration-150";

export async function SiteHeader() {
  const auth = await getOptionalAuth();
  const hasMemberships = auth.memberships.length > 0;
  const singleOrgSlug =
    auth.memberships.length === 1 ? auth.memberships[0].organization.slug : null;

  return (
    <header className="border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
        <Link href="/" aria-label="TheCOE — home">
          <Logo />
        </Link>
        <nav className="flex flex-wrap items-center gap-6 lg:gap-8" aria-label="Primary">
          <Link href="/jobs" className={navLinkClass}>
            Jobs
          </Link>
          <Link href="/post" className={navLinkClass}>
            Post a job
          </Link>
          {auth.configured && auth.hasCandidateProfile ? (
            <Link href="/me/profile" className={navLinkClass}>
              My account
            </Link>
          ) : null}
          {auth.configured && hasMemberships ? (
            <Link
              href={
                singleOrgSlug
                  ? `/employer/${singleOrgSlug}/jobs`
                  : "/employer"
              }
              className={navLinkClass}
            >
              Employer
            </Link>
          ) : null}
          {auth.configured && auth.isAdmin ? (
            <Link href="/admin/jobs" className={navLinkClass}>
              Admin
            </Link>
          ) : null}
          {auth.configured && auth.user ? (
            <SignOutButton />
          ) : auth.configured ? (
            <Link href="/login" className={navLinkClass}>
              Sign in
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
