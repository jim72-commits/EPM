import type { Metadata } from "next";

import { subscribeToNewsletter } from "@/app/newsletter/actions";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Anaplan hiring and compensation insights across North America, sent monthly.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ERROR_COPY: Record<string, string> = {
  invalid_email: "Please enter a valid email address.",
  service_unavailable:
    "Subscriptions aren't wired up yet. Check back after the next deploy.",
  server_error: "Something went wrong saving your subscription. Try again.",
};

export default async function NewsletterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? ERROR_COPY[errorKey] : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Newsletter
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Anaplan market signals, monthly.
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
        A short email covering hiring trends, certification updates, salary
        benchmarks, and select open roles for Anaplan modelers and architects
        across the United States and Canada. No spam, one-click unsubscribe.
      </p>

      <form
        action={subscribeToNewsletter}
        className="mt-12 flex flex-wrap items-end gap-3 border-t border-hairline pt-10"
      >
        <div className="flex-1 min-w-[16rem]">
          <label
            htmlFor="newsletter-email"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Email
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>
        <input type="hidden" name="source" value="newsletter_page" />
        <button
          type="submit"
          className="inline-flex h-[2.375rem] items-center justify-center border border-transparent bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          Subscribe
        </button>
      </form>

      {errorMessage ? (
        <p className="mt-4 text-sm text-[color:var(--color-error,#b00020)]">
          {errorMessage}
        </p>
      ) : null}

      <p className="mt-6 text-xs leading-relaxed text-muted">
        We use double opt-in. You&apos;ll get a confirmation email before
        anything lands in your inbox. Unsubscribe any time via the link in
        every email.
      </p>
    </main>
  );
}
