"use client";

import { useState } from "react";

type Props = {
  url: string;
  className?: string;
};

/**
 * One-click copy of an invite link. We expose this only on the manual
 * fallback banner (when email delivery fails) so the URL never leaks into
 * the per-row pending invites list — that would let any org member peek
 * at invite links they didn't create.
 */
export function CopyInviteLinkButton({ url, className }: Props) {
  const [copied, setCopied] = useState<boolean>(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers refuse clipboard access without a permissions
      // prompt; fall back to selecting the URL for the user to copy.
      window.prompt("Copy this invite URL", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        "inline-flex items-center justify-center border border-amber-300 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-amber-900 hover:bg-amber-100"
      }
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
