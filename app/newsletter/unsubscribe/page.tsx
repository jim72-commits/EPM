import type { Metadata } from "next";
import Link from "next/link";

import { confirmUnsubscribe } from "@/app/newsletter/unsubscribe/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ERROR_COPY: Record<string, string> = {
  invalid: "This link is invalid.",
  unavailable: "The unsubscribe service isn't available yet.",
  server_error: "Something went wrong. Try again.",
};

// We render the unsubscribe confirmation as a POST form so that email clients
// pre-fetching links (to preview or scan) cannot silently unsubscribe users.
export default async function NewsletterUnsubscribePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? ERROR_COPY[errorKey] : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Newsletter
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Unsubscribe
      </h1>
      <p className="mt-6 text-base leading-relaxed text-muted">
        Click below to remove your email from the TheCOE newsletter.
      </p>

      <form action={confirmUnsubscribe} className="mt-8">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={!token}
          className="inline-flex h-[2.375rem] items-center justify-center border border-transparent bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm unsubscribe
        </button>
      </form>

      {!token ? (
        <p className="mt-4 text-sm text-muted">
          Missing token — use the unsubscribe link from any newsletter edition.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 text-sm text-[color:var(--color-error,#b00020)]">
          {errorMessage}
        </p>
      ) : null}

      <Link
        href="/newsletter"
        className="mt-12 text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        ← Back to newsletter
      </Link>
    </main>
  );
}
