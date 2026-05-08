/**
 * TheCOE canonical logo.
 *
 * Outlined-box lettermark: a "The" wordmark next to "COE" set in a
 * thin-bordered box. Both elements set in Fraunces (editorial serif).
 * "COE" carries the meaning (Community of Excellence) so it occupies the
 * box; "The" sits ahead as the article.
 *
 * This is THE brand mark. Render it via `<Logo />` anywhere the site
 * identity is displayed. Other candidate components remain in this
 * folder for historical reference but should not be imported outside
 * of `/brand`.
 */
export function Logo() {
  return (
    <span className="group inline-flex items-center gap-1.5 font-[family-name:var(--font-fraunces)]">
      <span className="text-lg font-semibold leading-none tracking-[-0.01em] text-foreground transition-colors duration-150 group-hover:text-accent">
        The
      </span>
      <span className="inline-flex h-7 items-center border border-foreground bg-transparent px-2 text-sm font-semibold leading-none tracking-[0.04em] text-foreground transition-colors duration-150 group-hover:border-accent group-hover:text-accent">
        COE
      </span>
    </span>
  );
}
