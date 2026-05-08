import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Configure Supabase environment variables to enable authentication and
          admin tools. Until then, the public site uses mock job data only.
        </p>
      </main>
    );
  }

  await requireAdmin();

  return (
    <div className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-6">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Admin
          </p>
          <nav className="flex flex-wrap gap-6 text-xs font-medium uppercase tracking-[0.12em]">
            <Link
              href="/admin/moderation"
              className="text-muted hover:text-foreground"
            >
              Moderation
            </Link>
            <Link href="/admin/jobs" className="text-muted hover:text-foreground">
              Jobs
            </Link>
            <Link
              href="/admin/organizations"
              className="text-muted hover:text-foreground"
            >
              Organizations
            </Link>
            <Link
              href="/admin/applications"
              className="text-muted hover:text-foreground"
            >
              Applications
            </Link>
            <Link
              href="/admin/newsletter"
              className="text-muted hover:text-foreground"
            >
              Newsletter
            </Link>
            <Link
              href="/admin/alerts"
              className="text-muted hover:text-foreground"
            >
              Alerts
            </Link>
            <Link
              href="/admin/outcomes"
              className="text-muted hover:text-foreground"
            >
              Outcomes
            </Link>
            <Link
              href="/admin/reports"
              className="text-muted hover:text-foreground"
            >
              Reports
            </Link>
            <Link
              href="/admin/analytics"
              className="text-muted hover:text-foreground"
            >
              Analytics
            </Link>
            <Link href="/jobs" className="text-muted hover:text-foreground">
              View site
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-10 lg:px-8">{children}</div>
    </div>
  );
}
