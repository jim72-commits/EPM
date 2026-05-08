import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getOptionalAuth } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const dynamic = "force-dynamic";

export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Configure Supabase environment variables to enable candidate
          accounts. Until then, the public site runs on mock data only.
        </p>
      </main>
    );
  }

  const auth = await getOptionalAuth();
  if (!auth.user) {
    redirect("/login?next=/me/profile");
  }
  if (!auth.hasCandidateProfile) {
    redirect("/signup/candidate?reason=complete_profile");
  }

  return (
    <div className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            My account
          </p>
          <nav
            className="flex flex-wrap gap-6 text-xs font-medium uppercase tracking-[0.12em]"
            aria-label="Candidate"
          >
            <Link
              href="/me/profile"
              className="text-muted hover:text-foreground"
            >
              Profile
            </Link>
            <Link
              href="/me/applications"
              className="text-muted hover:text-foreground"
            >
              Applications
            </Link>
            <Link href="/jobs" className="text-muted hover:text-foreground">
              Browse jobs
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-10 lg:px-8">{children}</div>
    </div>
  );
}
