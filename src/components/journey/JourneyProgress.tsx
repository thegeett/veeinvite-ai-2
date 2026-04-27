// JourneyProgress — typeset table-of-contents row for the wizard flow.
// Renders at the top of /onboarding, /onboarding/step-2, /dashboard
// (plan §34.4). Server-component-friendly: no client state, no hooks.

import Link from "next/link";
import { hrefFor, type JourneyReachable, type StepNumber } from "./helpers";

export { computeReachable, type JourneyReachable } from "./helpers";

interface JourneyProgressProps {
  current: StepNumber;
  reachable: JourneyReachable;
  /** Required to build hrefs for steps 2 and 3 once they're reachable. */
  coupleId?: string;
  slug?: string;
}

const STEPS: ReadonlyArray<{ num: string; name: string }> = [
  { num: "01", name: "Basics" },
  { num: "02", name: "Brief" },
  { num: "03", name: "Studio" },
  { num: "04", name: "Guests" }
];

export function JourneyProgress({
  current,
  reachable,
  coupleId,
  slug
}: JourneyProgressProps) {
  return (
    <nav
      aria-label="Authoring journey"
      className="border-b border-line bg-canvas"
    >
      <ol className="mx-auto flex max-w-[1400px] items-baseline gap-x-10 overflow-x-auto px-6 py-5 md:gap-x-16 md:px-10">
        {STEPS.map((step, i) => {
          const stepNum = (i + 1) as StepNumber;
          const isActive = stepNum === current;
          const stepReachable =
            stepNum === 1
              ? true
              : stepNum === 2
                ? reachable[2]
                : stepNum === 3
                  ? reachable[3]
                  : reachable[4];
          const href =
            isActive || !stepReachable ? null : hrefFor(stepNum, coupleId, slug);
          const isComingSoon = stepNum === 4 && !reachable[4];

          // Number tone: blush when active, stone when reachable, faded
          // stone when locked.
          const numberClass = isActive
            ? "veein-meta text-blush"
            : stepReachable
              ? "veein-meta text-stone"
              : "veein-meta text-stone/40";

          // Name tone: ink when active, hover-ink when reachable, faded
          // stone when locked.
          const nameClass = [
            "font-serif text-base md:text-lg leading-none transition-colors",
            isActive
              ? "text-ink"
              : stepReachable
                ? "text-ink/65 group-hover:text-ink"
                : "text-stone/55"
          ].join(" ");

          const inner = (
            <span className="group inline-flex items-baseline gap-3">
              <span className={numberClass}>{step.num}</span>
              {/* Name visible on md+; on mobile only the active step shows
                  its name to keep the bar from wrapping/scrolling. */}
              <span
                className={[
                  nameClass,
                  isActive ? "inline" : "hidden md:inline"
                ].join(" ")}
              >
                {step.name}
              </span>
              {isComingSoon && (
                <span className="hidden md:inline veein-meta italic text-stone/60">
                  Coming soon
                </span>
              )}
            </span>
          );

          return (
            <li
              key={step.num}
              className="relative shrink-0"
              aria-current={isActive ? "step" : undefined}
            >
              {href ? (
                <Link
                  href={href}
                  className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-ink/30"
                >
                  {inner}
                </Link>
              ) : (
                <span aria-disabled={!stepReachable && !isActive}>{inner}</span>
              )}
              {/* Active marker — blush hairline anchored beneath the label.
                  Reads as a typographic underline, not a button outline. */}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -bottom-2 left-0 h-px w-full bg-blush"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
