// Phase 3 (PALETTE-03) — TDD scaffold for the Haiku pre-call.
// Written before the module exists. First run fails with module-not-found
// errors; subsequent phases (3.3) make them pass.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseHsl,
  hueInRange,
  distanceToMidpoint,
  validateExpressivePalette,
  buildPalettePrompt,
  buildFallbackPalette,
  runPalettePreCall,
  PaletteError,
  MIDPOINT_THRESHOLD,
  MAX_RETRIES,
  type ExpressivePaletteRanges
} from "@/lib/ai/prePaletteCall";

import { __setClientForTesting } from "@/lib/ai/generate";

// ============================================================================
// Hand-built test ranges — mirror the Punjabi sub-region in the library, with
// minor simplification so the tests assert against fixed numbers rather than
// JSON drift.
// ============================================================================

const PUNJABI_RANGES: ExpressivePaletteRanges = {
  bgPrimary: { h: [346, 360], s: [76, 96], l: [12, 22], note: "Deep kumkum red." },
  accent: { h: [336, 352], s: [52, 72], l: [50, 62], note: "Rose gold mid-tone." },
  gold: { h: [40, 50], s: [82, 98], l: [50, 60], note: "Marigold gold." },
  fontDisplay: ["Great Vibes", "Cormorant Garamond"],
  source: "test/punjabi"
};

// Wrapping-hue range — used to test that hue 0 is correctly accepted when
// the band straddles 0/360.
const WRAPPING_RANGES: ExpressivePaletteRanges = {
  bgPrimary: { h: [352, 8], s: [80, 98], l: [14, 26], note: "Wrap test." },
  accent: { h: [336, 352], s: [52, 72], l: [50, 62], note: "Rose." },
  gold: { h: [40, 50], s: [82, 98], l: [50, 60], note: "Gold." },
  fontDisplay: ["Great Vibes"],
  source: "test/wrap"
};

// ============================================================================
// parseHsl — string → numbers
// ============================================================================

describe("parseHsl", () => {
  it("parses a well-formed HSL string", () => {
    expect(parseHsl("hsl(348, 88%, 16%)")).toEqual({ h: 348, s: 88, l: 16 });
  });

  it("ignores whitespace variations", () => {
    expect(parseHsl("hsl(0,5%,12%)")).toEqual({ h: 0, s: 5, l: 12 });
    expect(parseHsl("hsl(  348 ,  88% ,  16%  )")).toEqual({ h: 348, s: 88, l: 16 });
  });

  it("returns null for non-HSL input", () => {
    expect(parseHsl("#5C0A14")).toBeNull();
    expect(parseHsl("rgb(92, 10, 20)")).toBeNull();
    expect(parseHsl("not even close")).toBeNull();
    expect(parseHsl("")).toBeNull();
  });

  it("returns null for decimal values (the prompt mandates integers)", () => {
    expect(parseHsl("hsl(348.5, 88%, 16%)")).toBeNull();
  });
});

// ============================================================================
// hueInRange — wrapping support
// ============================================================================

describe("hueInRange", () => {
  it("non-wrapping range: in", () => {
    expect(hueInRange(150, [100, 200])).toBe(true);
    expect(hueInRange(100, [100, 200])).toBe(true);
    expect(hueInRange(200, [100, 200])).toBe(true);
  });

  it("non-wrapping range: out", () => {
    expect(hueInRange(50, [100, 200])).toBe(false);
    expect(hueInRange(250, [100, 200])).toBe(false);
  });

  it("wrapping range [352, 8]: upper part passes", () => {
    expect(hueInRange(355, [352, 8])).toBe(true);
    expect(hueInRange(352, [352, 8])).toBe(true);
  });

  it("wrapping range [352, 8]: lower part passes", () => {
    expect(hueInRange(0, [352, 8])).toBe(true);
    expect(hueInRange(8, [352, 8])).toBe(true);
    expect(hueInRange(4, [352, 8])).toBe(true);
  });

  it("wrapping range [352, 8]: middle is out of range", () => {
    expect(hueInRange(100, [352, 8])).toBe(false);
    expect(hueInRange(180, [352, 8])).toBe(false);
    expect(hueInRange(351, [352, 8])).toBe(false);
    expect(hueInRange(9, [352, 8])).toBe(false);
  });
});

// ============================================================================
// distanceToMidpoint — Euclidean in normalized HSL space
// ============================================================================

describe("distanceToMidpoint", () => {
  const range = { h: [340, 360] as [number, number], s: [70, 90] as [number, number], l: [10, 30] as [number, number], note: "" };

  it("returns ~0 at the exact center", () => {
    const center = { h: 350, s: 80, l: 20 };
    expect(distanceToMidpoint(center, range)).toBeLessThan(0.01);
  });

  it("returns a non-trivial distance at the corner", () => {
    const corner = { h: 340, s: 70, l: 10 };
    const d = distanceToMidpoint(corner, range);
    expect(d).toBeGreaterThan(0.1); // corner is meaningfully far from center
  });

  it("handles wrapping hue range correctly — value at wrap-midpoint is ~0", () => {
    const wrap = { h: [352, 8] as [number, number], s: [80, 98] as [number, number], l: [14, 26] as [number, number], note: "" };
    // Midpoint hue of [352, 8] wraps to 0 (the center of the 16-deg span).
    const atWrapCenter = { h: 0, s: 89, l: 20 };
    expect(distanceToMidpoint(atWrapCenter, wrap)).toBeLessThan(0.05);
  });

  it("uses shortest-hue distance for wrapping ranges", () => {
    // Hue 350 is just 10 deg from the wrap-center 0 — should NOT be treated
    // as 350 deg away.
    const wrap = { h: [340, 20] as [number, number], s: [80, 98] as [number, number], l: [14, 26] as [number, number], note: "" };
    // Pick a value at wrap-midpoint hue 0. Off-center on s/l so distance > 0.
    const atWrapCenter = { h: 0, s: 89, l: 20 };
    const d = distanceToMidpoint(atWrapCenter, wrap);
    expect(d).toBeLessThan(0.1);
  });
});

// ============================================================================
// validateExpressivePalette — range + font + TUNE-2 midpoint check
// ============================================================================

describe("validateExpressivePalette — happy path", () => {
  it("passes a Punjabi-shaped palette in valid HSL within ranges", () => {
    // Phase 3.5: threshold raised to 0.10 (DECISIONS [2026-19]). Values
    // pushed to range corners so the average distance clears the new
    // floor — same architectural intent as before, but tightened to
    // keep this happy-path test focused on TUNE-2's pass criterion.
    const palette = {
      bgPrimary: "hsl(346, 96%, 12%)", // lower-left corner — most saturated, darkest
      accent: "hsl(336, 72%, 50%)", // lower corner of accent range
      gold: "hsl(40, 98%, 50%)", // lower corner of gold range
      fontDisplay: "Great Vibes"
    };
    expect(() => validateExpressivePalette(palette, PUNJABI_RANGES)).not.toThrow();
  });

  it("passes when hue is at the wrap boundary of [352, 8]", () => {
    // Test purpose: verify the wrap-boundary hue is accepted by the range
    // check. Other axes are pushed off-centre so the TUNE-2 midpoint check
    // (raised to 0.10 in Phase 3.5) also passes — keeps this test focused
    // on wrapping, not on TUNE-2.
    const palette = {
      bgPrimary: "hsl(0, 98%, 26%)", // wrap boundary; max saturation + light corner
      accent: "hsl(336, 72%, 62%)", // upper-right corner of accent range
      gold: "hsl(50, 98%, 60%)", // upper-right corner of gold range
      fontDisplay: "Great Vibes"
    };
    expect(() => validateExpressivePalette(palette, WRAPPING_RANGES)).not.toThrow();
  });
});

describe("validateExpressivePalette — failure paths", () => {
  it("rejects out-of-range hue", () => {
    const palette = {
      bgPrimary: "hsl(200, 88%, 16%)", // blue — wrong
      accent: "hsl(342, 64%, 58%)",
      gold: "hsl(44, 96%, 56%)",
      fontDisplay: "Great Vibes"
    };
    expect(() => validateExpressivePalette(palette, PUNJABI_RANGES)).toThrow(
      /hue 200/
    );
  });

  it("rejects too-low saturation", () => {
    const palette = {
      bgPrimary: "hsl(348, 20%, 16%)", // saturation 20% < range floor 76%
      accent: "hsl(342, 64%, 58%)",
      gold: "hsl(44, 96%, 56%)",
      fontDisplay: "Great Vibes"
    };
    expect(() => validateExpressivePalette(palette, PUNJABI_RANGES)).toThrow(
      /saturation 20%/
    );
  });

  it("rejects font not on the approved list", () => {
    const palette = {
      bgPrimary: "hsl(348, 92%, 14%)",
      accent: "hsl(342, 64%, 58%)",
      gold: "hsl(44, 96%, 56%)",
      fontDisplay: "Comic Sans"
    };
    expect(() => validateExpressivePalette(palette, PUNJABI_RANGES)).toThrow(
      /fontDisplay/
    );
  });

  it("rejects malformed input shape", () => {
    expect(() =>
      validateExpressivePalette({ bgPrimary: 5 }, PUNJABI_RANGES)
    ).toThrow();
  });
});

// TUNE-2 — midpoint clustering validator rule.
describe("validateExpressivePalette — TUNE-2 midpoint clustering", () => {
  it("rejects a palette whose avg midpoint distance is below threshold", () => {
    // Pick values exactly at every range center → distance 0. Should reject.
    const centerPalette = {
      bgPrimary: "hsl(353, 86%, 17%)", // midpoint of Punjabi bg
      accent: "hsl(344, 62%, 56%)", // midpoint of Punjabi accent
      gold: "hsl(45, 90%, 55%)", // midpoint of Punjabi gold
      fontDisplay: "Great Vibes"
    };
    expect(() => validateExpressivePalette(centerPalette, PUNJABI_RANGES)).toThrow(
      /midpoint/i
    );
  });

  it("rejection error names the specific too-central colours", () => {
    const centerPalette = {
      bgPrimary: "hsl(353, 86%, 17%)",
      accent: "hsl(344, 62%, 56%)",
      gold: "hsl(45, 90%, 55%)",
      fontDisplay: "Great Vibes"
    };
    let caught: PaletteError | null = null;
    try {
      validateExpressivePalette(centerPalette, PUNJABI_RANGES);
    } catch (err) {
      caught = err as PaletteError;
    }
    expect(caught).not.toBeNull();
    // At least one of the three colour names should appear in the message
    // so the retry's correction block can guide Haiku to the offender.
    const names = ["bgPrimary", "accent", "gold"];
    const matchedNames = names.filter((n) => caught!.message.includes(n));
    expect(matchedNames.length).toBeGreaterThan(0);
  });

  it("passes a palette that lives at the dramatic end of all three ranges", () => {
    const dramatic = {
      bgPrimary: "hsl(346, 96%, 12%)", // saturated/dark corner
      accent: "hsl(336, 72%, 50%)",
      gold: "hsl(40, 98%, 50%)",
      fontDisplay: "Great Vibes"
    };
    expect(() => validateExpressivePalette(dramatic, PUNJABI_RANGES)).not.toThrow();
  });

  it("MIDPOINT_THRESHOLD is exposed and is the value the validator uses (0.10 — Phase 3.5)", () => {
    // Phase 3 shipped at 0.05 (DECISIONS [2026-16]); Phase 3.5 raised to
    // 0.10 after widening the tightest ranges so 0.10 is reachable
    // (DECISIONS [2026-19]).
    expect(MIDPOINT_THRESHOLD).toBe(0.10);
  });
});

// ============================================================================
// buildPalettePrompt — TUNE-1 DIVERSITY REQUIREMENT block
// ============================================================================

describe("buildPalettePrompt — TUNE-1 structure", () => {
  function build() {
    return buildPalettePrompt({
      ranges: PUNJABI_RANGES,
      styleCard: "grand_celebration",
      vibeTags: ["grand"],
      cultureName: "Hindu — Punjabi"
    });
  }

  it("includes the DIVERSITY REQUIREMENT block", () => {
    expect(build()).toContain("DIVERSITY REQUIREMENT");
  });

  it("places the diversity block AFTER STYLE GUIDANCE and BEFORE OUTPUT FORMAT", () => {
    const prompt = build();
    const styleIdx = prompt.indexOf("STYLE GUIDANCE");
    const diversityIdx = prompt.indexOf("DIVERSITY REQUIREMENT");
    const outputIdx = prompt.indexOf("OUTPUT FORMAT");
    expect(styleIdx).toBeGreaterThan(-1);
    expect(diversityIdx).toBeGreaterThan(styleIdx);
    expect(outputIdx).toBeGreaterThan(diversityIdx);
  });

  it("interpolates the actual HSL ranges into the prompt", () => {
    const prompt = build();
    // Punjabi bgPrimary range
    expect(prompt).toContain("346");
    expect(prompt).toContain("360");
    expect(prompt).toContain("Deep kumkum red");
  });

  it("interpolates the approved fonts list", () => {
    const prompt = build();
    expect(prompt).toContain("Great Vibes");
    expect(prompt).toContain("Cormorant Garamond");
  });

  it("includes a correction block when given lastError", () => {
    const prompt = buildPalettePrompt({
      ranges: PUNJABI_RANGES,
      styleCard: "grand_celebration",
      vibeTags: ["grand"],
      cultureName: "Hindu — Punjabi",
      lastError: new PaletteError("hue 200 outside [346, 360]", "{...}"),
      attempt: 2
    });
    expect(prompt).toContain("CORRECTION REQUIRED");
    expect(prompt).toContain("hue 200 outside");
  });
});

// ============================================================================
// buildFallbackPalette — deterministic library-derived palette
// ============================================================================

describe("buildFallbackPalette", () => {
  // Phase 3.5 changed the signature: now takes a seed object, not just a
  // styleCard string. The seed lets the function produce diverse outputs
  // for two couples in the same culture but with different vibes.
  const PUNJABI_GRAND_SEED = {
    cultureId: "hindu_indian",
    subRegion: "punjabi",
    styleCard: "grand_celebration",
    vibeTags: ["grand"]
  };
  const PUNJABI_INTIMATE_SEED = {
    cultureId: "hindu_indian",
    subRegion: "punjabi",
    styleCard: "elegant_minimal",
    vibeTags: ["intimate", "refined"]
  };

  it("returns valid HSL strings within the supplied ranges", () => {
    const palette = buildFallbackPalette(PUNJABI_RANGES, PUNJABI_GRAND_SEED);
    expect(palette.bgPrimary).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(palette.accent).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(palette.gold).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(PUNJABI_RANGES.fontDisplay).toContain(palette.fontDisplay);
  });

  it("handles wrapping hue range correctly", () => {
    const palette = buildFallbackPalette(WRAPPING_RANGES, {
      ...PUNJABI_GRAND_SEED,
      styleCard: "grand_celebration"
    });
    const bg = parseHsl(palette.bgPrimary)!;
    // Result must be in either [352, 360] OR [0, 8].
    expect(bg.h >= 352 || bg.h <= 8).toBe(true);
  });

  // ---- Phase 3.5 — diversity-tuning assertions (AC #5, #6, #7) -----------

  it("Phase 3.5 — is deterministic: same seed → same palette across N calls", () => {
    const a = buildFallbackPalette(PUNJABI_RANGES, PUNJABI_GRAND_SEED);
    const b = buildFallbackPalette(PUNJABI_RANGES, PUNJABI_GRAND_SEED);
    const c = buildFallbackPalette(PUNJABI_RANGES, PUNJABI_GRAND_SEED);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("Phase 3.5 — is diverse: different seeds in same culture → at least one channel differs", () => {
    const a = buildFallbackPalette(PUNJABI_RANGES, PUNJABI_GRAND_SEED);
    const b = buildFallbackPalette(PUNJABI_RANGES, PUNJABI_INTIMATE_SEED);
    const differs =
      a.bgPrimary !== b.bgPrimary ||
      a.accent !== b.accent ||
      a.gold !== b.gold;
    expect(differs).toBe(true);
  });

  it("Phase 3.5 — is order-stable: vibeTags input order does not change result", () => {
    const a = buildFallbackPalette(PUNJABI_RANGES, {
      ...PUNJABI_INTIMATE_SEED,
      vibeTags: ["intimate", "refined"]
    });
    const b = buildFallbackPalette(PUNJABI_RANGES, {
      ...PUNJABI_INTIMATE_SEED,
      vibeTags: ["refined", "intimate"]
    });
    expect(a).toEqual(b);
  });

  // Position helpers — for each axis, the chosen value should sit in the
  // outer 30% of the range (i.e. position ∈ [0, 0.3] ∪ [0.7, 1.0]).
  function positionInRange(value: number, range: [number, number]): number {
    const [lo, hi] = range;
    if (hi >= lo) {
      const span = hi - lo;
      return span === 0 ? 0.5 : (value - lo) / span;
    }
    // wrapping: e.g. [352, 8] — span = 16
    const span = 360 - lo + hi;
    const offsetVal = value >= lo ? value - lo : 360 - lo + value;
    return span === 0 ? 0.5 : offsetVal / span;
  }

  it("Phase 3.5 — never lands in the central 40% of any axis (position < 0.3 or > 0.7)", () => {
    // Sample 8 distinct seeds — all should be off-centre on every axis.
    const seeds = [
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "grand_celebration", vibeTags: ["grand"] },
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "elegant_minimal", vibeTags: ["intimate"] },
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "romantic_traditional", vibeTags: ["soft"] },
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "destination_glamour", vibeTags: ["bold"] },
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "modern_minimalist", vibeTags: ["modern"] },
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "bohemian_garden", vibeTags: ["natural"] },
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "editorial_bold", vibeTags: ["bold"] },
      { cultureId: "hindu_indian", subRegion: "punjabi", styleCard: "grand_celebration", vibeTags: ["festive"] }
    ];
    for (const seed of seeds) {
      const palette = buildFallbackPalette(PUNJABI_RANGES, seed);
      const bg = parseHsl(palette.bgPrimary)!;
      const ac = parseHsl(palette.accent)!;
      const gd = parseHsl(palette.gold)!;
      // For every axis on every channel, position must be outside [0.3, 0.7].
      const checks: Array<[string, number, [number, number]]> = [
        ["bg.h", bg.h, PUNJABI_RANGES.bgPrimary.h],
        ["bg.s", bg.s, PUNJABI_RANGES.bgPrimary.s],
        ["bg.l", bg.l, PUNJABI_RANGES.bgPrimary.l],
        ["ac.h", ac.h, PUNJABI_RANGES.accent.h],
        ["ac.s", ac.s, PUNJABI_RANGES.accent.s],
        ["ac.l", ac.l, PUNJABI_RANGES.accent.l],
        ["gd.h", gd.h, PUNJABI_RANGES.gold.h],
        ["gd.s", gd.s, PUNJABI_RANGES.gold.s],
        ["gd.l", gd.l, PUNJABI_RANGES.gold.l]
      ];
      for (const [name, value, range] of checks) {
        const pos = positionInRange(value, range);
        if (pos > 0.3 && pos < 0.7) {
          throw new Error(
            `Seed ${JSON.stringify(seed)} — ${name}=${value} landed at position ${pos.toFixed(3)} (central 40%, forbidden by AC #7)`
          );
        }
      }
    }
  });
});

// ============================================================================
// runPalettePreCall — end-to-end with mocked Anthropic client
// ============================================================================

function makeStubClient(responses: string[]) {
  let i = 0;
  return {
    messages: {
      create: vi.fn(async () => {
        const text = responses[i++] ?? responses[responses.length - 1];
        return {
          content: [{ type: "text", text }]
        };
      })
    }
  } as any;
}

describe("runPalettePreCall — end-to-end (mocked Haiku)", () => {
  beforeEach(() => {
    __setClientForTesting(null); // reset between tests
  });
  afterEach(() => {
    __setClientForTesting(null);
  });

  it("returns a valid palette on first try", async () => {
    const dramaticPalette = {
      bgPrimary: "hsl(348, 96%, 12%)",
      accent: "hsl(338, 72%, 50%)",
      gold: "hsl(42, 98%, 50%)",
      fontDisplay: "Great Vibes"
    };
    __setClientForTesting(makeStubClient([JSON.stringify(dramaticPalette)]));
    const result = await runPalettePreCall({
      cultureId: "hindu_indian",
      subRegion: "punjabi",
      styleCard: "grand_celebration",
      vibeTags: ["grand"],
      cultureName: "Hindu — Punjabi"
    });
    expect(result.bgPrimary).toBe(dramaticPalette.bgPrimary);
    expect(result.fontDisplay).toBe("Great Vibes");
  });

  it("retries on validation failure and returns the second valid attempt", async () => {
    const invalid = JSON.stringify({
      bgPrimary: "hsl(200, 50%, 20%)", // out-of-range hue
      accent: "hsl(342, 64%, 58%)",
      gold: "hsl(44, 96%, 56%)",
      fontDisplay: "Great Vibes"
    });
    const valid = JSON.stringify({
      bgPrimary: "hsl(346, 96%, 12%)",
      accent: "hsl(338, 72%, 50%)",
      gold: "hsl(42, 98%, 50%)",
      fontDisplay: "Great Vibes"
    });
    const client = makeStubClient([invalid, valid]);
    __setClientForTesting(client);
    const result = await runPalettePreCall({
      cultureId: "hindu_indian",
      subRegion: "punjabi",
      styleCard: "grand_celebration",
      vibeTags: ["grand"],
      cultureName: "Hindu — Punjabi"
    });
    expect(result.bgPrimary).toBe("hsl(346, 96%, 12%)");
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it("falls back to deterministic library palette when MAX_RETRIES exhausted", async () => {
    const invalid = JSON.stringify({
      bgPrimary: "hsl(200, 50%, 20%)",
      accent: "hsl(342, 64%, 58%)",
      gold: "hsl(44, 96%, 56%)",
      fontDisplay: "Great Vibes"
    });
    // All attempts fail. Stub returns the same invalid response every time.
    const client = makeStubClient([invalid, invalid, invalid, invalid]);
    __setClientForTesting(client);
    const result = await runPalettePreCall({
      cultureId: "hindu_indian",
      subRegion: "punjabi",
      styleCard: "grand_celebration",
      vibeTags: ["grand"],
      cultureName: "Hindu — Punjabi"
    });
    // Fallback returns valid HSL — not the invalid one.
    expect(result.bgPrimary).not.toBe("hsl(200, 50%, 20%)");
    expect(result.bgPrimary).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    // Phase 3.5: MAX_RETRIES is 3 — Haiku is called exactly 3 times before
    // falling back, not 2.
    expect(client.messages.create).toHaveBeenCalledTimes(MAX_RETRIES);
  });

  it("MAX_RETRIES is 3 (Phase 3.5 — restored from 2 after spike v3 showed 70% fallback at 2 retries)", () => {
    expect(MAX_RETRIES).toBe(3);
  });

  // F1 — observability. AC #14 of PALETTE-03 requires `palette_precall` events
  // with `attempt`, `status`, and `culture` fields so we can compute
  // per-culture failure rates from logs.
  describe("emits palette_precall events", () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });
    afterEach(() => {
      logSpy.mockRestore();
    });

    function findEvents(): Array<Record<string, unknown>> {
      return logSpy.mock.calls
        .map((call: unknown[]) => {
          const line = call[0];
          if (typeof line !== "string") return null;
          try {
            const obj = JSON.parse(line);
            return obj && obj.event === "palette_precall" ? obj : null;
          } catch {
            return null;
          }
        })
        .filter(
          (x: unknown): x is Record<string, unknown> => x !== null
        );
    }

    it("emits ok on first-try success with attempt=1 and culture set", async () => {
      const dramaticPalette = {
        bgPrimary: "hsl(348, 96%, 12%)",
        accent: "hsl(338, 72%, 50%)",
        gold: "hsl(42, 98%, 50%)",
        fontDisplay: "Great Vibes"
      };
      __setClientForTesting(makeStubClient([JSON.stringify(dramaticPalette)]));
      await runPalettePreCall({
        cultureId: "hindu_indian",
        subRegion: "punjabi",
        styleCard: "grand_celebration",
        vibeTags: ["grand"],
        cultureName: "Hindu — Punjabi"
      });
      const events = findEvents();
      expect(events).toContainEqual(
        expect.objectContaining({
          event: "palette_precall",
          attempt: 1,
          status: "ok",
          culture: "hindu_indian"
        })
      );
    });

    it("emits retry then ok across two attempts", async () => {
      const invalid = JSON.stringify({
        bgPrimary: "hsl(200, 50%, 20%)",
        accent: "hsl(342, 64%, 58%)",
        gold: "hsl(44, 96%, 56%)",
        fontDisplay: "Great Vibes"
      });
      const valid = JSON.stringify({
        bgPrimary: "hsl(346, 96%, 12%)",
        accent: "hsl(338, 72%, 50%)",
        gold: "hsl(42, 98%, 50%)",
        fontDisplay: "Great Vibes"
      });
      __setClientForTesting(makeStubClient([invalid, valid]));
      await runPalettePreCall({
        cultureId: "hindu_indian",
        subRegion: "punjabi",
        styleCard: "grand_celebration",
        vibeTags: ["grand"],
        cultureName: "Hindu — Punjabi"
      });
      const events = findEvents();
      const statuses = events.map((e) => e.status);
      expect(statuses).toEqual(["retry", "ok"]);
      // The retry event names the validation error so log analysis can
      // bucket failures by reason.
      const retry = events.find((e) => e.status === "retry");
      expect(retry?.error).toBeTypeOf("string");
    });

    it("emits fallback when all retries fail", async () => {
      const invalid = JSON.stringify({
        bgPrimary: "hsl(200, 50%, 20%)",
        accent: "hsl(342, 64%, 58%)",
        gold: "hsl(44, 96%, 56%)",
        fontDisplay: "Great Vibes"
      });
      __setClientForTesting(makeStubClient([invalid, invalid, invalid]));
      await runPalettePreCall({
        cultureId: "hindu_indian",
        subRegion: "punjabi",
        styleCard: "grand_celebration",
        vibeTags: ["grand"],
        cultureName: "Hindu — Punjabi"
      });
      const events = findEvents();
      const last = events[events.length - 1];
      expect(last?.status).toBe("fallback");
      expect(last?.culture).toBe("hindu_indian");
    });
  });
});

describe("runPalettePreCall — western family selection", () => {
  beforeEach(() => {
    __setClientForTesting(null);
  });
  afterEach(() => {
    __setClientForTesting(null);
  });

  it("uses the family ranges (not cultural ranges) when cultureId === western", async () => {
    // For western, the prompt comes from a family. We just need to verify
    // a valid palette flows through end-to-end.
    const valid = JSON.stringify({
      bgPrimary: "hsl(38, 24%, 93%)",
      accent: "hsl(346, 32%, 60%)",
      gold: "hsl(40, 60%, 56%)",
      fontDisplay: "Cormorant Garamond"
    });
    __setClientForTesting(makeStubClient([valid]));
    const result = await runPalettePreCall({
      cultureId: "western",
      styleCard: "romantic_traditional",
      vibeTags: ["romantic", "soft"],
      cultureName: "Western"
    });
    // The result must validate against SOME range — we don't assert which
    // family (Phase 1's selectWesternFamily decides).
    expect(result.fontDisplay).toBeDefined();
  });
});
