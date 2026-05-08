"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type Outcome =
  | "hired_here"
  | "hired_elsewhere"
  | "not_hired_no_fit"
  | "not_hired_cancelled";

type ApplicantOption = {
  id: string;
  status: string;
  full_name: string;
  headline: string | null;
};

type Props = {
  action: (formData: FormData) => void;
  applicants: ApplicantOption[];
  cancelHref: string;
  defaultOutcome?: Outcome | null;
  defaultHiredAppId?: string;
  defaultFeedback?: string;
};

const OUTCOME_OPTIONS: Array<{ value: Outcome; title: string; blurb: string }> = [
  {
    value: "hired_here",
    title: "Hired through TheCOE",
    blurb:
      "You found and hired one of the applicants on this listing. Pick the candidate below.",
  },
  {
    value: "hired_elsewhere",
    title: "Hired, but not through TheCOE",
    blurb:
      "You filled the role from a different channel (referral, recruiter, etc.).",
  },
  {
    value: "not_hired_no_fit",
    title: "Closed without hiring",
    blurb:
      "You looked at the applicants but decided not to move anyone forward.",
  },
  {
    value: "not_hired_cancelled",
    title: "Role pulled / cancelled",
    blurb: "Headcount changed, or the role was put on hold or scrapped.",
  },
];

export function CloseListingForm({
  action,
  applicants,
  cancelHref,
  defaultOutcome,
  defaultHiredAppId,
  defaultFeedback,
}: Props) {
  // No outcome is pre-selected unless we're rehydrating from a server-side
  // error. Forcing an explicit choice avoids the first-click trap where the
  // default outcome ("hired here") plus the default attribution ("no
  // applicant chosen") fail server-side validation.
  const [outcome, setOutcome] = useState<Outcome | null>(
    defaultOutcome ?? null,
  );
  const [hiredAppId, setHiredAppId] = useState<string>(
    defaultHiredAppId ?? "",
  );

  const requiresAttribution = outcome === "hired_here";
  const canSubmit =
    outcome != null &&
    (!requiresAttribution || hiredAppId.length > 0) &&
    (requiresAttribution || hiredAppId.length === 0);

  function handleOutcomeChange(next: Outcome) {
    setOutcome(next);
    // Switching outcomes resets the applicant pick. If the user was on
    // "hired here" with someone selected and switches to "hired elsewhere",
    // server-side validation would reject a stale applicant id, so we
    // clear it preemptively.
    setHiredAppId("");
  }

  return (
    <form action={action} className="mt-8 space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Outcome
        </legend>
        {OUTCOME_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer gap-4 border border-hairline px-4 py-4 transition-colors has-[input:checked]:border-foreground has-[input:checked]:bg-surface"
          >
            <input
              type="radio"
              name="outcome"
              value={opt.value}
              checked={outcome === opt.value}
              onChange={() => handleOutcomeChange(opt.value)}
              required
              className="mt-1 h-4 w-4 accent-foreground"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                {opt.title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {opt.blurb}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* Attribution only matters for "hired_here". For other outcomes we
          submit an empty value, which the server treats as "no attribution"
          and the schema accepts. */}
      {requiresAttribution ? (
        <fieldset className="space-y-3">
          <legend className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Pick the candidate you hired
          </legend>

          {applicants.length === 0 ? (
            <p className="text-sm text-muted">
              No applicants to choose from. If you hired through TheCOE, the
              candidate must have applied here first — pick a different
              outcome.
            </p>
          ) : (
            <AttributionList
              applicants={applicants}
              value={hiredAppId}
              onChange={setHiredAppId}
            />
          )}
        </fieldset>
      ) : (
        <input type="hidden" name="hired_application_id" value="" />
      )}

      <div className="space-y-2">
        <label
          htmlFor="feedback"
          className="text-xs font-medium uppercase tracking-[0.14em] text-muted"
        >
          What worked / what didn&apos;t (optional)
        </label>
        <textarea
          id="feedback"
          name="feedback"
          rows={5}
          maxLength={4000}
          defaultValue={defaultFeedback ?? ""}
          placeholder="Quality of applicants, what made the hire stand out, anything we should improve…"
          className="w-full border border-hairline bg-surface px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted">
          We read every one. 4,000 character limit.
        </p>
      </div>

      <div className="border-t border-hairline pt-6">
        <p className="text-xs leading-relaxed text-muted">
          On close: the listing comes off the public board, the candidate you
          attribute (if any) flips to <strong>Hired</strong>, and any
          remaining applicants are auto-rejected so they get a clean signal.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center border border-transparent bg-accent px-6 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close listing
          </button>
          <CancelLink href={cancelHref} />
        </div>
        {!canSubmit ? (
          <p className="mt-3 text-xs text-muted">
            {outcome == null
              ? "Pick an outcome to continue."
              : "Pick which candidate you hired."}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function AttributionList({
  applicants,
  value,
  onChange,
}: {
  applicants: ApplicantOption[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="border border-hairline">
      {applicants.map((a) => (
        <label
          key={a.id}
          className="flex cursor-pointer items-center gap-3 border-b border-hairline px-4 py-3 last:border-0 has-[input:checked]:bg-surface"
        >
          <input
            type="radio"
            name="hired_application_id"
            value={a.id}
            checked={value === a.id}
            onChange={() => onChange(a.id)}
            className="h-4 w-4 accent-foreground"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground">
              {a.full_name}
            </span>
            {a.headline ? (
              <span className="block text-xs text-muted">{a.headline}</span>
            ) : null}
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
            {a.status.replace(/_/g, " ")}
          </span>
        </label>
      ))}
    </div>
  );
}

function CancelLink({ href }: { href: string }): ReactNode {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center border border-hairline px-6 text-sm font-medium text-foreground transition-colors hover:border-foreground"
    >
      Cancel
    </Link>
  );
}
