import type { Metadata } from "next";

import { Logo } from "@/components/logo/logo";
import {
  MarkBlockOutlineGrotesk,
  MarkBlockOutlineMono,
  MarkBlockOutlineSerif,
} from "@/components/logo/mark-block-outline";
import {
  MarkAscendingBars,
  MarkBreakout,
  MarkChevron,
  MarkConstellation,
  MarkDiagonal,
  MarkDots,
  MarkDualPeak,
  MarkEArrow,
  MarkHorizon,
  MarkSteps,
} from "@/components/logo/marks-set";

export const metadata: Metadata = {
  title: "Brand preview",
  robots: { index: false, follow: false },
};

type HeadlineProposal = {
  id: string;
  label: string;
  font: string;
  notes: string;
  Mark: () => React.ReactElement;
};

const HEADLINE: HeadlineProposal[] = [
  {
    id: "A",
    label: "Outlined box · Mono",
    font: "Geist Mono",
    notes:
      "Technical, enterprise-software register. Mono-spacing makes the ANA letters feel precise and systems-y — a fit for the Anaplan/FP&A audience.",
    Mark: MarkBlockOutlineMono,
  },
  {
    id: "B",
    label: "Outlined box · Space Grotesk",
    font: "Space Grotesk",
    notes:
      "Geometric display sans with subtle character in the strokes. Modern without being trendy — distinct from the Geist body copy around it.",
    Mark: MarkBlockOutlineGrotesk,
  },
  {
    id: "C",
    label: "Outlined box · Fraunces",
    font: "Fraunces",
    notes:
      "Editorial serif. Feels authoritative and established — closer to a publication masthead than a startup logo.",
    Mark: MarkBlockOutlineSerif,
  },
];

type Attribute = "Ambition" | "Growth" | "Future" | "Professionalism";

type ExplorationProposal = {
  n: number;
  name: string;
  attrs: Attribute[];
  notes: string;
  Mark: () => React.ReactElement;
};

const EXPLORATIONS: ExplorationProposal[] = [
  {
    n: 1,
    name: "Ascending bars",
    attrs: ["Growth", "Professionalism"],
    notes:
      "Classic growth-chart mark in the FP&A register. Reads instantly as performance and quarterly climb.",
    Mark: MarkAscendingBars,
  },
  {
    n: 2,
    name: "Upward chevron",
    attrs: ["Ambition", "Future"],
    notes: "Pure directional mark. Minimal, decisive, no data baggage.",
    Mark: MarkChevron,
  },
  {
    n: 3,
    name: "Dual peak",
    attrs: ["Growth", "Ambition"],
    notes:
      "Rises, dips, then summits higher. Narrates a growth journey rather than stating it.",
    Mark: MarkDualPeak,
  },
  {
    n: 4,
    name: "Diagonal in frame",
    attrs: ["Professionalism", "Growth"],
    notes: "Disciplined growth line contained inside a square. Audit-ready.",
    Mark: MarkDiagonal,
  },
  {
    n: 5,
    name: "Steps",
    attrs: ["Ambition", "Growth"],
    notes: "Career-ladder metaphor at full volume.",
    Mark: MarkSteps,
  },
  {
    n: 6,
    name: "E with arrow middle bar",
    attrs: ["Professionalism", "Future"],
    notes:
      "Custom E letterform where the middle stroke becomes an arrow. Most ownable of the set.",
    Mark: MarkEArrow,
  },
  {
    n: 7,
    name: "Rising dots",
    attrs: ["Future", "Growth"],
    notes: "Scatter-plot trajectory. Quiet, modern, tech-forward.",
    Mark: MarkDots,
  },
  {
    n: 8,
    name: "Horizon",
    attrs: ["Future", "Ambition"],
    notes: "Sun rising over a baseline. Dawn / new-chapter metaphor.",
    Mark: MarkHorizon,
  },
  {
    n: 9,
    name: "Breakout arrow",
    attrs: ["Ambition", "Future"],
    notes: "Arrow escaping a frame. The job-change narrative as geometry.",
    Mark: MarkBreakout,
  },
  {
    n: 10,
    name: "Constellation",
    attrs: ["Professionalism", "Growth"],
    notes:
      "Connected points rising. Networked and analytical — a model, not a startup.",
    Mark: MarkConstellation,
  },
];

export default function BrandPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-16 lg:px-8 lg:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        Internal · Brand preview
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Logo proposals
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
        The shipped logo is pinned at the top. Considered variants and the
        wider exploration set are preserved below for reference.
      </p>

      {/* Active logo */}
      <section className="mt-12 border border-accent bg-surface">
        <div className="flex items-baseline justify-between border-b border-hairline px-6 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
            Shipped · active logo
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Outlined box · Fraunces
          </p>
        </div>
        <div className="flex min-h-[10rem] items-center justify-center px-6 py-12">
          <Logo />
        </div>
        <div className="border-t border-hairline px-6 py-5">
          <p className="text-sm text-muted">
            Selected from round 02, Option C. Outlined box around the ANA
            lettermark, paired with an editorial serif &ldquo;Circle&rdquo;
            wordmark. Live in the site header.
          </p>
        </div>
      </section>

      {/* Headline: outlined-box variants */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-hairline pb-3">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-foreground">
            Round 02 · considered variants
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            Option C shipped
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {HEADLINE.map(({ id, label, font, notes, Mark }) => (
            <article
              key={id}
              className="flex flex-col border border-hairline bg-surface"
            >
              <div className="flex min-h-[8rem] items-center justify-center border-b border-hairline px-6 py-10">
                <Mark />
              </div>
              <div className="flex-1 px-6 py-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-accent">
                    Option {id}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                    {font}
                  </p>
                </div>
                <p className="mt-3 text-base font-semibold text-foreground">
                  {label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {notes}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {HEADLINE.map(({ id, Mark }) => (
            <div
              key={id}
              className="relative flex h-16 items-center border border-hairline bg-page px-6"
            >
              <span className="absolute right-2 top-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                {id}
              </span>
              <Mark />
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-muted">
          Above: each variant on the live page surface at real header
          height. This is the scan test — if a mark survives here, it&rsquo;s
          ship-ready.
        </p>
      </section>

      {/* Explorations: 10-mark set */}
      <section className="mt-20 border-t border-hairline pt-12">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-foreground">
          Explorations · set 02
        </p>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Ten alternative directions keyed to the brief (Ambition, Growth,
          Future, Professionalism). Preserved for reference — any of these
          can be promoted to headline if one resonates.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {EXPLORATIONS.map(({ n, name, attrs, notes, Mark }) => (
            <article
              key={n}
              className="flex flex-col border border-hairline bg-surface"
            >
              <div className="flex min-h-[6rem] items-center justify-center border-b border-hairline px-4 py-6">
                <Mark />
              </div>
              <div className="flex-1 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  Proposal {n}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {name}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {attrs.map((attr) => (
                    <span
                      key={attr}
                      className="border border-hairline bg-page px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted"
                    >
                      {attr}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {notes}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-12 text-xs text-muted">
        One earlier proposal (the grid glyph in{" "}
        <code className="font-mono">components/logo/mark-grid.tsx</code>)
        remains in the codebase as a reference point. Two pre-rebrand variants
        were retired with the EPMHire → TheCOE rename.
      </p>
    </main>
  );
}
