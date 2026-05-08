import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Alert removed",
  robots: { index: false, follow: false },
};

export default function AlertUnsubscribedPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Job alerts
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Alert removed.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
        You&apos;re unsubscribed from that alert. Other alerts and your
        newsletter subscription stay active. Create a new alert any time at{" "}
        <Link href="/alerts" className="text-accent underline">
          /alerts
        </Link>
        .
      </p>
    </main>
  );
}
