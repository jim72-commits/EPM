"use client";

import { useTransition } from "react";

type Props = {
  /** Bound server action that performs the withdrawal. */
  withdrawAction: () => Promise<void>;
  /** Current application status — drives the confirmation copy. */
  status: "submitted" | "under_review" | "shortlisted";
};

/**
 * Confirmation-wrapped withdraw button. Shortlisted applications show a
 * stronger message because the consequences are bigger: the employer has
 * already moved them forward in the pipeline.
 */
export function WithdrawApplicationButton({ withdrawAction, status }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message =
      status === "shortlisted"
        ? "You've been shortlisted for this role. Withdraw anyway? The employer will see this status change and can no longer reach out about this listing."
        : "Withdraw this application? You won't be able to reapply to the same role.";
    if (!window.confirm(message)) return;
    startTransition(() => withdrawAction());
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center border border-hairline px-5 text-sm font-medium text-muted transition-colors hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Withdrawing…" : "Withdraw application"}
      </button>
    </form>
  );
}
