import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Check your inbox",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AlertPendingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Job alerts
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Check your inbox.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
        {email ? (
          <>
            We sent a confirmation link to{" "}
            <span className="text-foreground">{email}</span>. Click it to
            activate the alert.
          </>
        ) : (
          <>We sent you a confirmation link. Click it to activate the alert.</>
        )}
      </p>
      <p className="mt-6 text-sm text-muted">
        Nothing in a few minutes? Check spam, then{" "}
        <Link href="/alerts" className="text-accent underline">
          create a new alert
        </Link>
        .
      </p>
    </main>
  );
}
