"use client";

import { useActionState, useEffect, useState } from "react";

import {
  resendConfirmation,
  type ResendState,
} from "@/app/signup/verify/actions";

const INITIAL: ResendState = { status: "idle" };

type Props = {
  email: string;
  role?: "candidate" | "employer";
};

export function ResendConfirmationButton({ email, role }: Props) {
  const [state, formAction, pending] = useActionState(
    resendConfirmation,
    INITIAL,
  );

  // Local cooldown matches Supabase's default 60s email rate limit. We start
  // it from the submit handler instead of an effect-on-state so React doesn't
  // flag a setState-in-effect warning, and so the button locks the moment
  // the user clicks rather than after the round-trip.
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function handleSubmit(formData: FormData): void {
    // The button is disabled when email is empty, but a determined user can
    // remove the disabled attribute via devtools. Don't burn the cooldown on
    // a request that the server is going to reject — otherwise they're locked
    // out for 60s with no email actually sent.
    const submittedEmail = String(formData.get("email") ?? "").trim();
    if (!submittedEmail) return;
    setCooldown(60);
    formAction(formData);
  }

  const disabled = pending || cooldown > 0 || !email;
  const label = pending
    ? "Sending…"
    : cooldown > 0
      ? `Resend in ${cooldown}s`
      : "Resend confirmation email";

  return (
    <form action={handleSubmit} className="mt-6">
      <input type="hidden" name="email" value={email} />
      {role ? <input type="hidden" name="role" value={role} /> : null}
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-10 items-center justify-center border border-hairline px-4 text-xs font-medium uppercase tracking-[0.12em] text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {label}
      </button>
      {state.status === "error" && state.message ? (
        <p className="mt-3 text-xs leading-relaxed text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p
          className="mt-3 text-xs leading-relaxed text-foreground"
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      {state.status === "rate_limited" && state.message ? (
        <p
          className="mt-3 text-xs leading-relaxed text-muted"
          role="status"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      {!email ? (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          We can&apos;t resend without your email. Sign in instead, or sign up
          again.
        </p>
      ) : null}
    </form>
  );
}
