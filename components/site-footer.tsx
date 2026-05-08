import Link from "next/link";

import { SITE_NAME, SITE_TAGLINE, SUPPORT_MAILTO } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-hairline bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p className="text-xs uppercase tracking-[0.1em]">
          © {year} {SITE_NAME} · {SITE_TAGLINE}
        </p>
        <div className="flex gap-8 text-xs font-medium uppercase tracking-[0.12em]">
          <Link href="/newsletter" className="hover:text-foreground">
            Newsletter
          </Link>
          <a href={SUPPORT_MAILTO} className="hover:text-foreground">
            Contact
          </a>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
