/** Proposal 2: 2x2 grid glyph (one cell filled) + clean TheCOE wordmark. */
export function MarkGrid() {
  return (
    <span className="group inline-flex items-center gap-2">
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="h-5 w-5 text-accent transition-colors duration-150 group-hover:text-foreground"
      >
        <rect x="0" y="0" width="9" height="9" fill="currentColor" />
        <rect
          x="11"
          y="0"
          width="9"
          height="9"
          fill="currentColor"
          fillOpacity="0.28"
        />
        <rect
          x="0"
          y="11"
          width="9"
          height="9"
          fill="currentColor"
          fillOpacity="0.28"
        />
        <rect
          x="11"
          y="11"
          width="9"
          height="9"
          fill="currentColor"
          fillOpacity="0.28"
        />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-foreground transition-colors duration-150 group-hover:text-accent">
        TheCOE
      </span>
    </span>
  );
}
