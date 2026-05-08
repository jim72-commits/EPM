import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/is-configured";

import { setNewPassword } from "./actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/login?reason=supabase");
  }

  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  // Require a session — recovery codes are exchanged at /auth/callback first.
  // If a user lands here cold, send them back to request a new link.
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/forgot-password?error=expired");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-20 lg:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        TheCOE
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Set a new password
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Choose a password you&apos;ll remember. After saving, you&apos;ll sign
        in again with the new one.
      </p>

      {error ? (
        <p
          className="mt-8 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="status"
        >
          {error}
        </p>
      ) : null}

      <form action={setNewPassword} className="mt-10 space-y-6">
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <p className="mt-2 text-xs text-muted">8 characters minimum.</p>
        </div>
        <div>
          <label
            htmlFor="confirm"
            className="block text-xs font-medium uppercase tracking-[0.12em] text-muted"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-2 w-full border border-hairline bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center border border-transparent bg-accent text-sm font-medium text-on-accent transition-colors duration-150 hover:bg-accent-hover"
        >
          Save new password
        </button>
      </form>

      <p className="mt-10 text-xs uppercase tracking-[0.1em] text-muted">
        <Link href="/login" className="hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
