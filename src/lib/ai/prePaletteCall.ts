// Pre-call palette — PALETTE-03.
//
// A Haiku-driven pick of 4 expressive tokens (bgPrimary, accent, gold,
// fontDisplay) that flow into both Call 2 (full site design) and Call 3
// (hero) as locked constraints. Implements the architecture from
// `doc/PRECALL_IMPLEMENTATION_SPEC.md` plus the three TUNE additions
// surfaced by the Phase 2 spike (`doc/spikes/2026-04-27-haiku-hsl-spike.md`):
//
//   TUNE-1 — Anti-clustering "DIVERSITY REQUIREMENT" prompt block.
//   TUNE-2 — Validator rejects responses whose average midpoint distance is
//            below 0.15 (counts as a normal validation failure → retries).
//   TUNE-3 — MAX_RETRIES = 2 (down from 3; spike showed 100% pass on
//            attempt 1, second retry is enough to honour TUNE-2 corrections).
//
// All AI calls are server-only (architecture rule 10). The Anthropic client
// is reused from `generate.ts` (single cached singleton + test injection).

import {
  getCulturePaletteRanges,
  getWesternFamily,
  type CulturePaletteRanges,
  type HslRange,
  type WesternPaletteFamily
} from "@/lib/cultural/library";
import { selectWesternFamily } from "@/lib/ai/vibeTagPicker";
import { getClient } from "@/lib/ai/generate";
import { emitEvent } from "@/lib/observability/events";
import type { ExpressivePalette } from "@/lib/types";

const MODEL_HAIKU = "claude-haiku-4-5-20251001";

/**
 * MAX_RETRIES = 2 (TUNE-3). Spike data: 100% format/range/font pass on
 * attempt 1 → the third retry was dead weight. Two attempts cover normal
 * pass + one TUNE-2 midpoint-distance correction.
 */
export const MAX_RETRIES = 2;

/**
 * MIDPOINT_THRESHOLD = 0.05 (TUNE-2). Average HSL distance from the range
 * midpoints across the three colours, below which the validator rejects
 * the response as too central. Empirically tuned from the Phase 2 spike:
 *
 *   - Spike avg distance was ~0.089. Threshold of 0.05 rejects roughly
 *     the centermost 25% of unaided Haiku responses → those retry with
 *     a correction block, which the spec's prompt design handles well.
 *   - 0.05 is reachable for ALL library ranges (some are narrow enough
 *     that even corner values land at distance ~0.12; a higher threshold
 *     like 0.15 would be unachievable for tight ranges like Punjabi).
 *   - 0.05 is a meaningful "off-centre" floor — values closer than this
 *     are squarely in the middle 25% of every axis.
 *
 * The Phase 3 ticket spec'd 0.15; the calibration to 0.05 is documented
 * in DECISIONS [2026-16] with the rationale (tight cultural ranges cap
 * the maximum reachable distance below 0.15).
 */
export const MIDPOINT_THRESHOLD = 0.05;

// ============================================================================
// Types — shared with the test scaffold
// ============================================================================

export type ExpressivePaletteRanges = CulturePaletteRanges & {
  /** Provenance — `"hindu_indian/punjabi"` or `"western/botanical_garden"`.
   *  Logged in observability events; not used by the prompt or validator. */
  source: string;
};

export class PaletteError extends Error {
  constructor(
    message: string,
    public readonly raw: string
  ) {
    super(message);
    this.name = "PaletteError";
  }
}

// ============================================================================
// HSL parsing + range checks
// ============================================================================

const HSL_PATTERN = /^\s*hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)\s*$/;

/**
 * Parses `hsl(H, S%, L%)`. Whitespace tolerant. Decimals are rejected
 * deliberately (the prompt mandates integers). Returns null on any
 * malformed input.
 */
export function parseHsl(value: string): { h: number; s: number; l: number } | null {
  if (typeof value !== "string") return null;
  const match = value.match(HSL_PATTERN);
  if (!match) return null;
  return {
    h: parseInt(match[1], 10),
    s: parseInt(match[2], 10),
    l: parseInt(match[3], 10)
  };
}

/**
 * True when `h` is inside the (possibly wrapping) range. A range like
 * `[352, 8]` wraps through 0/360 — both 352 and 4 are "inside" it.
 */
export function hueInRange(h: number, range: [number, number]): boolean {
  if (range[0] <= range[1]) return h >= range[0] && h <= range[1];
  return h >= range[0] || h <= range[1];
}

/**
 * Euclidean distance from a parsed HSL value to the centre of its range,
 * normalised to [0, ~sqrt(3)]. Hue uses shortest-arc distance so wrapping
 * ranges are computed correctly.
 *
 * - 0 means the picked value is exactly at the midpoint.
 * - 0.15 is the TUNE-2 rejection threshold (average across 3 colours).
 * - Around 0.5 means "corner of the range" — strong divergence.
 */
export function distanceToMidpoint(
  picked: { h: number; s: number; l: number },
  range: HslRange
): number {
  // Hue midpoint, accounting for wrapping ranges like [352, 8].
  let hMid: number;
  if (range.h[0] <= range.h[1]) {
    hMid = (range.h[0] + range.h[1]) / 2;
  } else {
    const span = 360 - range.h[0] + range.h[1];
    const raw = range.h[0] + span / 2;
    hMid = raw >= 360 ? raw - 360 : raw;
  }

  // Shortest hue arc.
  const rawHueDelta = Math.abs(picked.h - hMid);
  const hueDelta = Math.min(rawHueDelta, 360 - rawHueDelta);

  const sMid = (range.s[0] + range.s[1]) / 2;
  const lMid = (range.l[0] + range.l[1]) / 2;

  // Normalise: hue 0..180 max, s/l 0..100 max.
  const dh = hueDelta / 180;
  const ds = Math.abs(picked.s - sMid) / 100;
  const dl = Math.abs(picked.l - lMid) / 100;
  return Math.sqrt(dh * dh + ds * ds + dl * dl);
}

// ============================================================================
// Validator — range + font + TUNE-2 midpoint check
// ============================================================================

/**
 * Validates a parsed palette object against the supplied ranges. Throws
 * `PaletteError` on any violation (caller decides whether to retry or
 * surface). Order of checks: shape → format → range → font → midpoint.
 *
 * The midpoint check (TUNE-2) is last so the error message can name the
 * specific too-central colours; the retry's correction block uses that
 * to guide Haiku.
 */
export function validateExpressivePalette(
  parsed: unknown,
  ranges: CulturePaletteRanges
): ExpressivePalette {
  if (!parsed || typeof parsed !== "object") {
    throw new PaletteError("response is not a JSON object", JSON.stringify(parsed));
  }
  const p = parsed as Record<string, unknown>;

  // Shape
  for (const k of ["bgPrimary", "accent", "gold", "fontDisplay"] as const) {
    if (typeof p[k] !== "string") {
      throw new PaletteError(`field "${k}" missing or not a string`, JSON.stringify(parsed));
    }
  }

  // Format
  const bg = parseHsl(p.bgPrimary as string);
  const ac = parseHsl(p.accent as string);
  const gd = parseHsl(p.gold as string);
  if (!bg || !ac || !gd) {
    throw new PaletteError(
      `colour values are not in hsl(H, S%, L%) format — bgPrimary=${p.bgPrimary} accent=${p.accent} gold=${p.gold}`,
      JSON.stringify(parsed)
    );
  }

  // Range
  const checks: Array<{ name: "bgPrimary" | "accent" | "gold"; v: { h: number; s: number; l: number }; r: HslRange }> = [
    { name: "bgPrimary", v: bg, r: ranges.bgPrimary },
    { name: "accent", v: ac, r: ranges.accent },
    { name: "gold", v: gd, r: ranges.gold }
  ];
  for (const c of checks) {
    if (!hueInRange(c.v.h, c.r.h)) {
      throw new PaletteError(
        `${c.name} hue ${c.v.h} outside required range [${c.r.h[0]}, ${c.r.h[1]}]. Cultural meaning: ${c.r.note}`,
        JSON.stringify(parsed)
      );
    }
    if (c.v.s < c.r.s[0] || c.v.s > c.r.s[1]) {
      throw new PaletteError(
        `${c.name} saturation ${c.v.s}% outside required range [${c.r.s[0]}%, ${c.r.s[1]}%]. Cultural meaning: ${c.r.note}`,
        JSON.stringify(parsed)
      );
    }
    if (c.v.l < c.r.l[0] || c.v.l > c.r.l[1]) {
      throw new PaletteError(
        `${c.name} lightness ${c.v.l}% outside required range [${c.r.l[0]}%, ${c.r.l[1]}%]. Cultural meaning: ${c.r.note}`,
        JSON.stringify(parsed)
      );
    }
  }

  // Font
  const fontLower = (p.fontDisplay as string).toLowerCase();
  const approvedLower = ranges.fontDisplay.map((f) => f.toLowerCase());
  if (!approvedLower.includes(fontLower)) {
    throw new PaletteError(
      `fontDisplay "${p.fontDisplay}" is not in the approved list for this culture: ${ranges.fontDisplay.join(", ")}`,
      JSON.stringify(parsed)
    );
  }

  // TUNE-2 — midpoint clustering
  const distances: Record<"bgPrimary" | "accent" | "gold", number> = {
    bgPrimary: distanceToMidpoint(bg, ranges.bgPrimary),
    accent: distanceToMidpoint(ac, ranges.accent),
    gold: distanceToMidpoint(gd, ranges.gold)
  };
  const avg = (distances.bgPrimary + distances.accent + distances.gold) / 3;
  if (avg < MIDPOINT_THRESHOLD) {
    const tooCentral = (Object.entries(distances) as [keyof typeof distances, number][])
      .filter(([, d]) => d < MIDPOINT_THRESHOLD)
      .map(([name]) => name);
    throw new PaletteError(
      `Palette is too close to range midpoints (avg distance ${avg.toFixed(3)} < ${MIDPOINT_THRESHOLD}). ` +
        `Specifically these colours are too central: ${tooCentral.join(", ")}. ` +
        `Push them toward the end of their range that matches the brief — saturated/dark for grand/dramatic/festive, quieter/lighter for intimate/refined/contemporary.`,
      JSON.stringify(parsed)
    );
  }

  return {
    bgPrimary: p.bgPrimary as string,
    accent: p.accent as string,
    gold: p.gold as string,
    fontDisplay: p.fontDisplay as string
  };
}

// ============================================================================
// Prompt builder — TUNE-1 DIVERSITY REQUIREMENT block included
// ============================================================================

interface BuildPromptInput {
  ranges: CulturePaletteRanges;
  styleCard: string;
  vibeTags: string[];
  cultureName: string;
  /** When set, prepends a CORRECTION REQUIRED block summarising the prior
   *  failure — the retry then tells Haiku exactly what to fix. */
  lastError?: PaletteError | null;
  attempt?: number;
}

export function buildPalettePrompt(input: BuildPromptInput): string {
  const { ranges, styleCard, vibeTags, cultureName, lastError, attempt } = input;

  const correction =
    lastError && (attempt ?? 1) > 1
      ? `CORRECTION REQUIRED — YOUR PREVIOUS RESPONSE HAD AN ERROR:
${lastError.message}

Fix this specific problem. Then return the complete JSON object.

`
      : "";

  return `${correction}You are picking exact colors for a wedding invitation.
Pick ONE specific HSL value for each color field.
Your choices must fall WITHIN the ranges given — not outside them.

Couple brief:
  Culture:    ${cultureName}
  Style card: ${styleCard}
  Vibe tags:  ${vibeTags.length > 0 ? vibeTags.join(", ") : "none selected"}

COLOR RANGES — pick within these:

bgPrimary (the card background):
  Hue:        ${ranges.bgPrimary.h[0]}–${ranges.bgPrimary.h[1]}
  Saturation: ${ranges.bgPrimary.s[0]}%–${ranges.bgPrimary.s[1]}%
  Lightness:  ${ranges.bgPrimary.l[0]}%–${ranges.bgPrimary.l[1]}%
  Meaning:    ${ranges.bgPrimary.note}

accent (buttons, name highlights, glow effects):
  Hue:        ${ranges.accent.h[0]}–${ranges.accent.h[1]}
  Saturation: ${ranges.accent.s[0]}%–${ranges.accent.s[1]}%
  Lightness:  ${ranges.accent.l[0]}%–${ranges.accent.l[1]}%
  Meaning:    ${ranges.accent.note}

gold (decorative elements, dividers, eyebrow text):
  Hue:        ${ranges.gold.h[0]}–${ranges.gold.h[1]}
  Saturation: ${ranges.gold.s[0]}%–${ranges.gold.s[1]}%
  Lightness:  ${ranges.gold.l[0]}%–${ranges.gold.l[1]}%
  Meaning:    ${ranges.gold.note}

fontDisplay (used for couple names — choose one):
  ${ranges.fontDisplay.join(", ")}

STYLE GUIDANCE:
Use the style card and vibe tags to choose WHERE within each range.
  Romantic / intimate / soft → warmer, slightly lighter end of range
  Grand / opulent / dramatic → most saturated, most dramatic end
  Minimal / clean / modern   → cooler, quieter end of range

DIVERSITY REQUIREMENT — IMPORTANT:
Avoid the midpoint of each range. Pick values in the upper or lower
portion of each range based on the style + tags. Two couples in the
same culture should get visibly different palettes, not the same
center-of-range values.

If your H, S, or L would land within 15% of the range center, push
toward the end that better matches the brief — saturated/dark for
"grand / dramatic / festive", quieter/lighter for "intimate / refined
/ contemporary".

Examples of GOOD divergent picks within the same range:
  Range h: [346, 360], s: [76, 96], l: [12, 22]
    Couple A (grand):     hsl(358, 94%, 14%)  — vivid red, very dark
    Couple B (intimate):  hsl(348, 80%, 20%)  — softer red, lighter
  NOT both: hsl(353, 86%, 17%) (the centre — boring).

OUTPUT FORMAT — CRITICAL:
Return ONLY this JSON object. No explanation. No markdown fences.
Start with { and end with }.

{
  "bgPrimary":   "hsl(H, S%, L%)",
  "accent":      "hsl(H, S%, L%)",
  "gold":        "hsl(H, S%, L%)",
  "fontDisplay": "Font Name Here"
}

Rules:
- H, S, L must be integers within the ranges above
- Do not use decimal values
- fontDisplay must be exactly one of: ${ranges.fontDisplay.join(", ")}
- Pick SPECIFIC values — not the midpoint of every range
  Two couples with the same culture should get different values`;
}

// ============================================================================
// Fallback palette — deterministic, no AI
// ============================================================================

/**
 * Picks a single HSL value within `range` based on a 0..1 position.
 * Position 0 = range[0]; position 1 = range[1]; 0.5 = midpoint. Hue
 * wrapping handled. Used by the deterministic fallback when Haiku fails
 * all retries.
 */
function hslRangeToValue(
  range: HslRange,
  positionH: number,
  positionS: number,
  positionL: number
): string {
  let h: number;
  if (range.h[0] <= range.h[1]) {
    h = Math.round(range.h[0] + (range.h[1] - range.h[0]) * positionH);
  } else {
    const span = 360 - range.h[0] + range.h[1];
    const raw = range.h[0] + span * positionH;
    h = Math.round(raw >= 360 ? raw - 360 : raw);
  }
  const s = Math.round(range.s[0] + (range.s[1] - range.s[0]) * positionS);
  const l = Math.round(range.l[0] + (range.l[1] - range.l[0]) * positionL);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Style-card-driven position within each colour's HSL range. Higher = more
 * saturated/dramatic. The fallback palette uses these to pick a sensible
 * point for the styleCard without an AI call.
 */
const STYLE_POSITION: Record<string, number> = {
  grand_celebration: 0.85,
  editorial_bold: 0.9,
  romantic_traditional: 0.4,
  destination_glamour: 0.75,
  modern_minimalist: 0.2,
  elegant_minimal: 0.15,
  bohemian_garden: 0.5
};

/**
 * Builds a deterministic palette from library ranges. Used when Haiku's
 * retry budget is exhausted — fast (no network) and never fails. The
 * styleCard biases the position within each range so even fallback
 * palettes have some style-appropriate variation.
 */
export function buildFallbackPalette(
  ranges: CulturePaletteRanges,
  styleCard: string
): ExpressivePalette {
  const pos = STYLE_POSITION[styleCard] ?? 0.5;
  return {
    bgPrimary: hslRangeToValue(ranges.bgPrimary, pos, pos, pos),
    accent: hslRangeToValue(ranges.accent, pos, pos, pos),
    gold: hslRangeToValue(ranges.gold, pos, pos, pos),
    fontDisplay: ranges.fontDisplay[0]
  };
}

// ============================================================================
// Main entry point — runPalettePreCall
// ============================================================================

export interface RunPalettePreCallParams {
  cultureId: string;
  subRegion?: string;
  styleCard: string;
  vibeTags: string[];
  cultureName: string;
}

/**
 * Runs the pre-call: pick 4 expressive tokens via Haiku, validated against
 * the cultural HSL ranges. On retry-exhaustion, returns a deterministic
 * fallback derived from the library midpoints.
 *
 * For western cultures, `selectWesternFamily` (Phase 1) picks one of 8
 * aesthetic families from the vibe tags; the family's HSL ranges become
 * the prompt's constraints.
 */
export async function runPalettePreCall(
  params: RunPalettePreCallParams
): Promise<ExpressivePalette> {
  const ranges = resolveRanges(params);
  if (!ranges) {
    // Library has no palette data for this culture (shouldn't happen — all
    // 9 cultures are populated). Return a generic neutral fallback so the
    // pipeline doesn't blow up.
    return {
      bgPrimary: "hsl(0, 0%, 96%)",
      accent: "hsl(0, 0%, 20%)",
      gold: "hsl(40, 50%, 50%)",
      fontDisplay: "Cormorant Garamond"
    };
  }

  let lastError: PaletteError | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const prompt = buildPalettePrompt({
      ranges,
      styleCard: params.styleCard,
      vibeTags: params.vibeTags,
      cultureName: params.cultureName,
      lastError,
      attempt
    });

    let raw: string;
    try {
      const resp = await getClient().messages.create({
        model: MODEL_HAIKU,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }]
      });
      const textBlock = resp.content.find(
        (b): b is { type: "text"; text: string } & typeof b =>
          b.type === "text"
      );
      raw = textBlock?.text ?? "";
    } catch (err) {
      // Network / API error — surface immediately rather than retry.
      throw err;
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      lastError = new PaletteError("no JSON object found in response", raw);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch (err) {
      lastError = new PaletteError(
        `JSON parse error: ${(err as Error).message}`,
        raw
      );
      continue;
    }

    try {
      const palette = validateExpressivePalette(parsed, ranges);
      emitEvent("palette_precall", {
        attempt,
        status: "ok",
        culture: params.cultureId,
        subRegion: params.subRegion ?? null
      });
      return palette;
    } catch (err) {
      if (err instanceof PaletteError) {
        lastError = err;
        emitEvent("palette_precall", {
          attempt,
          status: "retry",
          culture: params.cultureId,
          subRegion: params.subRegion ?? null,
          error: err.message
        });
        continue;
      }
      throw err;
    }
  }

  // All retries exhausted — fall back to the deterministic library palette.
  emitEvent("palette_precall", {
    attempt: MAX_RETRIES,
    status: "fallback",
    culture: params.cultureId,
    subRegion: params.subRegion ?? null,
    error: lastError?.message ?? "unknown"
  });
  return buildFallbackPalette(ranges, params.styleCard);
}

/**
 * Resolves which HSL ranges apply to this couple. Western → family
 * selected by `selectWesternFamily`; cultural → sub-region or default
 * via `getCulturePaletteRanges`.
 */
function resolveRanges(
  params: RunPalettePreCallParams
): ExpressivePaletteRanges | null {
  if (params.cultureId === "western") {
    const familyId = selectWesternFamily(params.styleCard, params.vibeTags);
    const family = getWesternFamily(familyId);
    if (!family) return null;
    return adaptFamilyToRanges(family, `western/${familyId}`);
  }

  const cultural = getCulturePaletteRanges(params.cultureId, params.subRegion);
  if (!cultural) return null;
  const sourceTag = params.subRegion
    ? `${params.cultureId}/${params.subRegion}`
    : params.cultureId;
  return { ...cultural, source: sourceTag };
}

function adaptFamilyToRanges(
  family: WesternPaletteFamily,
  source: string
): ExpressivePaletteRanges {
  return {
    bgPrimary: family.bgPrimary,
    accent: family.accent,
    gold: family.gold,
    fontDisplay: family.fontDisplay,
    source
  };
}
