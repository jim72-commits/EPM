import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

export default function NewsletterUnsubscribedPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Newsletter
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        You&apos;re unsubscribed.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
        Your email has been removed from the TheCOE newsletter. Change your
        mind? You can{" "}
        <Link href="/newsletter" className="text-accent underline">
          subscribe again
        </Link>{" "}
        any time.
      </p>
    </main>
  );
}
