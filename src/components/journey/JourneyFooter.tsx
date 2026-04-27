// JourneyFooter — Previous / Next navigation pinned to the bottom of every
// wizard step (plan §34.4). Mirrors the JourneyProgress bar at the top so
// the user has matching way-finding on either edge of the page.

"use client";

import Link from "next/link";

type Previous = { label: string; href: string };

type NextSubmit = {
  type: "submit";
  label: string;
  /** Called when the Next button is clicked. The button is type="button"
   *  so callers can pass a no-arg handler that does its own preventDefault
   *  / validation. */
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
};

type NextLink = {
  type: "link";
  label: string;
  href?: string;
  disabled?: boolean;
  comingSoon?: boolean;
};

type Props = {
  previous?: Previous;
  next?: NextSubmit | NextLink;
};

export function JourneyFooter({ previous, next }: Props) {
  return (
    <nav
      aria-label="Wizard step navigation"
      className="border-t border-line bg-canvas mt-12"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-8 md:px-10">
        {/* Left: Previous (or empty placeholder for spacing) */}
        <div className="min-w-[1px]">
          {previous ? (
            <Link
              href={previous.href}
              className="group inline-flex items-baseline gap-3 transition-colors"
            >
              <span
                aria-hidden
                className="inline-block text-stone transition-transform group-hover:-translate-x-1 group-hover:text-ink"
              >
                ←
              </span>
              <span className="flex flex-col gap-1">
                <span className="veein-meta text-stone group-hover:text-ink transition-colors">
                  Previous
                </span>
                <span className="font-serif text-lg text-ink/85 group-hover:text-ink transition-colors">
                  {previous.label}
                </span>
              </span>
            </Link>
          ) : null}
        </div>

        {/* Right: Next */}
        <div className="min-w-[1px]">
          {next ? <NextControl next={next} /> : null}
        </div>
      </div>
    </nav>
  );
}

function NextControl({ next }: { next: NextSubmit | NextLink }) {
  if (next.type === "submit") {
    return (
      <button
        type="button"
        onClick={next.onClick}
        disabled={next.disabled || next.loading}
        className="group inline-flex items-baseline gap-3 transition-colors disabled:opacity-60"
      >
        <span className="flex flex-col items-end gap-1">
          <span className="veein-meta text-stone group-hover:text-ink transition-colors">
            Next
          </span>
          <span className="font-serif text-lg text-ink group-hover:text-blush transition-colors">
            {next.label}
          </span>
        </span>
        <span
          aria-hidden
          className="inline-block text-ink transition-transform group-hover:translate-x-1 group-hover:text-blush"
        >
          →
        </span>
      </button>
    );
  }

  // type === "link"
  if (next.disabled || !next.href) {
    return (
      <span className="inline-flex items-baseline gap-3 cursor-not-allowed">
        <span className="flex flex-col items-end gap-1">
          <span className="veein-meta text-stone/60">Next</span>
          <span className="font-serif text-lg text-stone/70">
            {next.label}
            {next.comingSoon ? (
              <span className="ml-3 veein-meta italic text-stone/60">
                Coming soon
              </span>
            ) : null}
          </span>
        </span>
        <span aria-hidden className="text-stone/60">
          →
        </span>
      </span>
    );
  }

  return (
    <Link
      href={next.href}
      className="group inline-flex items-baseline gap-3 transition-colors"
    >
      <span className="flex flex-col items-end gap-1">
        <span className="veein-meta text-stone group-hover:text-ink transition-colors">
          Next
        </span>
        <span className="font-serif text-lg text-ink group-hover:text-blush transition-colors">
          {next.label}
        </span>
      </span>
      <span
        aria-hidden
        className="inline-block text-ink transition-transform group-hover:translate-x-1 group-hover:text-blush"
      >
        →
      </span>
    </Link>
  );
}
