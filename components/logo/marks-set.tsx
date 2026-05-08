import type { ReactNode } from "react";

/**
 * Ten logo candidates. Each pairs a distinct glyph with an identical
 * TheCOE wordmark so the variable under evaluation is the glyph.
 * All marks read left-to-right and communicate some combination of:
 *   Ambition · Growth · Future · Professionalism.
 */

function Wordmark() {
  return (
    <span className="text-lg font-semibold tracking-tight text-foreground transition-colors duration-150 group-hover:text-accent">
      TheCOE
    </span>
  );
}

function MarkShell({ children }: { children: ReactNode }) {
  return (
    <span className="group inline-flex items-center gap-2">
      {children}
      <Wordmark />
    </span>
  );
}

const GLYPH_CLASSES =
  "h-6 w-6 shrink-0 text-accent transition-colors duration-150 group-hover:text-foreground";

/** 1. Ascending bars — growth chart, classic FP&A register. */
export function MarkAscendingBars() {
  return (
    <MarkShell>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={GLYPH_CLASSES}>
        <rect x="3" y="15" width="4" height="6" fill="currentColor" />
        <rect x="10" y="10" width="4" height="11" fill="currentColor" />
        <rect x="17" y="4" width="4" height="17" fill="currentColor" />
      </svg>
    </MarkShell>
  );
}

/** 2. Upward chevron — pure direction, ambition, forward. */
export function MarkChevron() {
  return (
    <MarkShell>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={GLYPH_CLASSES}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 17 L12 7 L20 17" />
      </svg>
    </MarkShell>
  );
}

/** 3. Dual peak — a growth path (rise, dip, rise higher). */
export function MarkDualPeak() {
  return (
    <MarkShell>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={GLYPH_CLASSES}>
        <path d="M2 20 L8 10 L12 15 L18 4 L22 20 Z" fill="currentColor" />
      </svg>
    </MarkShell>
  );
}

/** 4. Diagonal in square — contained, disciplined growth line. */
export function MarkDiagonal() {
  return (
    <MarkShell>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={GLYPH_CLASSES}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      >
        <rect x="2.5" y="2.5" width="19" height="19" strokeWidth="1.5" />
        <line x1="6" y1="18" x2="18" y2="6" strokeWidth="2" />
      </svg>
    </MarkShell>
  );
}

/** 5. Steps — career ladder, literal progression. */
export function MarkSteps() {
  return (
    <MarkShell>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={GLYPH_CLASSES}>
        <rect x="2" y="16" width="6" height="6" fill="currentColor" />
        <rect x="9" y="10" width="6" height="12" fill="currentColor" />
        <rect x="16" y="4" width="6" height="18" fill="currentColor" />
      </svg>
    </MarkShell>
  );
}

/** 6. E-monogram with arrow middle bar — branded forward motion. */
export function MarkEArrow() {
  return (
    <MarkShell>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={GLYPH_CLASSES}>
        <rect x="3" y="3" width="3" height="18" fill="currentColor" />
        <rect x="3" y="3" width="14" height="3" fill="currentColor" />
        <rect x="3" y="10.5" width="13" height="3" fill="currentColor" />
        <path d="M16 8 L22 12 L16 16 Z" fill="currentColor" />
        <rect x="3" y="18" width="14" height="3" fill="currentColor" />
      </svg>
    </MarkShell>
  );
}

/** 7. Rising dots — data-forward growth trajectory. */
export function MarkDots() {
  return (
    <MarkShell>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={GLYPH_CLASSES}>
        <circle cx="4" cy="20" r="1.8" fill="currentColor" />
        <circle cx="10" cy="15" r="1.8" fill="currentColor" />
        <circle cx="16" cy="10" r="1.8" fill="currentColor" />
        <circle cx="21" cy="4" r="1.8" fill="currentColor" />
      </svg>
    </MarkShell>
  );
}

/** 8. Horizon — a sun rising over a baseline. Future, dawn. */
export function MarkHorizon() {
  return (
    <MarkShell>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={GLYPH_CLASSES}>
        <line
          x1="2"
          y1="19"
          x2="22"
          y2="19"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M6 19 A 6 6 0 0 1 18 19 Z" fill="currentColor" />
      </svg>
    </MarkShell>
  );
}

/** 9. Breakout arrow — escaping a frame, ambitious momentum. */
export function MarkBreakout() {
  return (
    <MarkShell>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={GLYPH_CLASSES}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 14 V21 H14" strokeWidth="1.8" />
        <path d="M3 3 V11" strokeWidth="1.8" />
        <path d="M10 21 L21 21 V14" strokeWidth="1.8" />
        <path d="M21 3 L10 14" strokeWidth="2.2" />
        <path d="M14 3 H21 V10" strokeWidth="2.2" />
      </svg>
    </MarkShell>
  );
}

/** 10. Constellation — connected dots forming a networked rise. */
export function MarkConstellation() {
  return (
    <MarkShell>
      <svg viewBox="0 0 24 24" aria-hidden="true" className={GLYPH_CLASSES}>
        <line
          x1="4"
          y1="19"
          x2="10"
          y2="13"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line
          x1="10"
          y1="13"
          x2="15"
          y2="15"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line
          x1="15"
          y1="15"
          x2="21"
          y2="5"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle cx="4" cy="19" r="1.7" fill="currentColor" />
        <circle cx="10" cy="13" r="1.7" fill="currentColor" />
        <circle cx="15" cy="15" r="1.7" fill="currentColor" />
        <circle cx="21" cy="5" r="2.1" fill="currentColor" />
      </svg>
    </MarkShell>
  );
}
