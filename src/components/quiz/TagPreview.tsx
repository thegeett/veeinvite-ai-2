"use client";

// TagPreview — small panel shown on hover (desktop) / long-press (mobile)
// when the couple inspects a vibe tag. Two modes:
//   - western: 3 color circles + "Soft · Warm · Tender" keywords
//   - cultural: Decoration bar (0-5) + Motion bar (0-3) + keywords
//
// Aesthetic matches the existing editorial system already designed by the
// frontend-design skill for InvitationOverview / OnboardingStep1Form: the
// same paper-card surface, hairline borders, veein-meta eyebrows, font-serif
// labels. This component is consumed by VibeTagPicker.

import type {
  WesternTagDefinition,
  CulturalTagDefinition
} from "@/lib/ai/vibeTagPicker";

type Props =
  | { mode: "western"; tag: WesternTagDefinition }
  | { mode: "cultural"; tag: CulturalTagDefinition };

export function TagPreview(props: Props) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-40 w-64 rounded-md border border-line bg-canvas p-4 shadow-2xl"
      style={{ boxShadow: "0 24px 40px -16px rgba(29,26,26,0.22)" }}
    >
      {props.mode === "western" ? (
        <WesternPreview tag={props.tag} />
      ) : (
        <CulturalPreview tag={props.tag} />
      )}
    </div>
  );
}

function WesternPreview({ tag }: { tag: WesternTagDefinition }) {
  const [bg, accent, gold] = tag.preview.swatches;
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Swatch color={bg} label="background" />
        <Swatch color={accent} label="accent" />
        <Swatch color={gold} label="gold" />
      </div>
      <p className="font-serif text-sm leading-tight text-ink">
        {tag.preview.keywords}
      </p>
    </>
  );
}

function CulturalPreview({ tag }: { tag: CulturalTagDefinition }) {
  return (
    <>
      <DualBar
        decoration={tag.preview.decoration}
        motion={tag.preview.motion}
      />
      <p className="mt-3 font-serif text-sm leading-tight text-ink">
        {tag.preview.keywords}
      </p>
    </>
  );
}

/** A single 14px filled circle in the requested CSS color, surrounded by a
 *  thin hairline border so very-light swatches still register against the
 *  canvas background. */
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      className="inline-block h-5 w-5 rounded-full border border-line/60"
      style={{ backgroundColor: color }}
    />
  );
}

/** Decoration (0–5 segments) and Motion (0–3 segments) shown as two thin
 *  horizontal bars stacked. Each segment is a small inline-block; filled
 *  segments use bg-ink, empty segments use bg-line. The two axes are
 *  independent — vibrant fills Motion only, intimate fills both partially,
 *  contemporary only fills Decoration partially. */
function DualBar({
  decoration,
  motion
}: {
  decoration: number;
  motion: number;
}) {
  return (
    <div className="space-y-2">
      <BarRow label="Decoration" value={decoration} max={5} />
      <BarRow label="Motion" value={motion} max={3} />
    </div>
  );
}

function BarRow({
  label,
  value,
  max
}: {
  label: string;
  value: number;
  max: number;
}) {
  const segments = Array.from({ length: max }, (_, i) => i < value);
  return (
    <div className="flex items-center gap-3">
      <span className="veein-meta w-[5.5rem] text-stone">{label}</span>
      <div className="flex flex-1 items-center gap-1">
        {segments.map((filled, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-1.5 flex-1 rounded-sm transition-colors ${
              filled ? "bg-ink" : "bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
