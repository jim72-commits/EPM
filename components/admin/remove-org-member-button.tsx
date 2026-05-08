"use client";

import { useTransition } from "react";

import { removeOrgMember } from "@/app/admin/organizations/[id]/members/actions";

type Props = {
  organizationId: string;
  userId: string;
  display: string;
  role: "owner" | "member";
};

/**
 * Confirmation-gated remove button. The members list shows an opaque user
 * (email if resolvable, UUID otherwise), so a misclick on the wrong row
 * could quietly drop a real teammate's access. We require an explicit
 * confirm with the user identity in the prompt to make the action
 * recoverable in the head.
 */
export function RemoveOrgMemberButton({
  organizationId,
  userId,
  display,
  role,
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData: FormData) => {
        const ok = window.confirm(
          `Remove ${display} (${role}) from this organization?\n\nThey'll lose access to the employer dashboard immediately. You can re-add them later, but any in-flight work in their session will be cut off.`,
        );
        if (!ok) return;
        startTransition(() => {
          void removeOrgMember(formData);
        });
      }}
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="user_id" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
    </form>
  );
}
