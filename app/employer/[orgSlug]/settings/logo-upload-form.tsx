"use client";

import { useRef, useState } from "react";

const MAX_BYTES = 1 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

type Props = {
  action: (formData: FormData) => void;
};

/**
 * Client-side gatekeeper for the logo upload. Catches the obvious
 * size/type problems before the bytes leave the browser — gives the user
 * an instant "this is too big" error instead of a multi-second upload
 * round-trip that ends in a server-side rejection.
 *
 * The server still validates everything; this is purely UX.
 */
export function LogoUploadForm({ action }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [submittable, setSubmittable] = useState<boolean>(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setWarning(null);
      setSubmittable(false);
      return;
    }
    if (!ALLOWED.has(file.type)) {
      setWarning("That file type isn't supported. Use PNG, JPG, WebP, or SVG.");
      setSubmittable(false);
      return;
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setWarning(
        `That file is ${mb} MB — please upload something under 1 MB.`,
      );
      setSubmittable(false);
      return;
    }
    setWarning(null);
    setSubmittable(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!submittable) {
      e.preventDefault();
    }
  }

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="mt-6 space-y-4"
    >
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          Upload new logo
        </span>
        <input
          ref={fileInputRef}
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          onChange={handleChange}
          className="mt-2 block w-full text-sm text-foreground file:mr-4 file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-xs file:font-medium file:uppercase file:tracking-[0.1em] file:text-background hover:file:bg-accent hover:file:text-on-accent"
        />
      </label>
      {warning ? (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warning}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!submittable}
        className="inline-flex h-10 items-center justify-center border border-transparent bg-accent px-4 text-xs font-medium uppercase tracking-[0.1em] text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save logo
      </button>
    </form>
  );
}
