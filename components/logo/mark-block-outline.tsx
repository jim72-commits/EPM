/**
 * Outlined-box lettermark. A bordered box around "ANA" sits next to the
 * "Circle" wordmark. Three font variants below let us evaluate the
 * typographic register:
 *   - Mono     → Geist Mono (technical, enterprise-software)
 *   - Grotesk  → Space Grotesk (geometric display, modern)
 *   - Serif    → Fraunces (editorial, authoritative)
 */

type OutlineVariantProps = {
  fontClass: string;
  /** Optional per-font letter-spacing tuning on the "ANA" box. */
  boxTracking?: string;
  /** Optional per-font letter-spacing tuning on the "Circle" wordmark. */
  wordTracking?: string;
};

function OutlineMark({
  fontClass,
  boxTracking = "tracking-[0.08em]",
  wordTracking = "tracking-tight",
}: OutlineVariantProps) {
  return (
    <span className={`group inline-flex items-center gap-1.5 ${fontClass}`}>
      <span
        className={`inline-flex h-7 items-center border border-foreground bg-transparent px-2 text-sm font-semibold leading-none text-foreground transition-colors duration-150 group-hover:border-accent group-hover:text-accent ${boxTracking}`}
      >
        ANA
      </span>
      <span
        className={`text-lg font-semibold leading-none text-foreground transition-colors duration-150 group-hover:text-accent ${wordTracking}`}
      >
        Circle
      </span>
    </span>
  );
}

/** Geist Mono — technical, enterprise-software register. */
export function MarkBlockOutlineMono() {
  return (
    <OutlineMark
      fontClass="font-mono"
      boxTracking="tracking-[0.04em]"
      wordTracking="tracking-tight"
    />
  );
}

/** Space Grotesk — geometric display sans with character. */
export function MarkBlockOutlineGrotesk() {
  return (
    <OutlineMark
      fontClass="font-[family-name:var(--font-space-grotesk)]"
      boxTracking="tracking-[0.06em]"
      wordTracking="tracking-tight"
    />
  );
}

/** Fraunces — editorial serif, authoritative register. */
export function MarkBlockOutlineSerif() {
  return (
    <OutlineMark
      fontClass="font-[family-name:var(--font-fraunces)]"
      boxTracking="tracking-[0.04em]"
      wordTracking="tracking-[-0.01em]"
    />
  );
}
