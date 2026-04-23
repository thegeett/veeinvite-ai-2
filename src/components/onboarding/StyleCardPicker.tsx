"use client";

import type { StyleCard } from "@/lib/types";
import { LayoutMini } from "@/components/landing/LayoutMini";

// §27 tags table — each style card maps to a layout + a vibe palette.
const CARDS: Array<{
  id: StyleCard;
  flavor: "modern" | "romantic" | "grand" | "editorial";
  line: string;
}> = [
  { id: "Modern Minimalist",    flavor: "modern",    line: "Airy, disciplined, restrained." },
  { id: "Romantic Traditional", flavor: "romantic",  line: "Warm, layered, a love letter." },
  { id: "Bohemian Garden",      flavor: "modern",    line: "Natural, earthy, garden party." },
  { id: "Elegant Minimal",      flavor: "modern",    line: "Soft, refined, elegant white space." },
  { id: "South Asian Grand",    flavor: "grand",     line: "Multi-event, rich, celebratory." },
  { id: "Destination Glamour",  flavor: "editorial", line: "Dramatic, luxurious, cinematic." },
  { id: "Editorial Bold",       flavor: "editorial", line: "Asymmetric, confident, fashion-forward." }
];

export function StyleCardPicker({
  value,
  onChange
}: {
  value: StyleCard | undefined;
  onChange: (v: StyleCard) => void;
}) {
  return (
    <div>
      <h3 className="font-serif text-2xl mb-1">Your visual mood</h3>
      <p className="text-ink/70 text-sm mb-5">
        Pick what feels most you. Changes the design immediately — nothing is locked in.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => {
          const active = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`group relative rounded-md border p-3 text-left transition-all ${
                active
                  ? "border-ink ring-2 ring-ink/60"
                  : "border-line bg-paper hover:border-ink/50"
              }`}
            >
              <div className="w-full">
                <LayoutMini flavor={c.flavor} />
              </div>
              <div className="mt-3">
                <div className="font-serif text-base leading-tight">{c.id}</div>
                <div className="text-sm text-ink/60 mt-0.5">{c.line}</div>
              </div>
              {active ? (
                <span className="veein-meta absolute top-3 right-3 rounded-full bg-ink px-2 py-0.5 text-canvas">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
