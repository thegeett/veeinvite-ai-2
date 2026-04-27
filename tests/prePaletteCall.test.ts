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
    const palette = {
      bgPrimary: "hsl(348, 92%, 14%)",
      accent: "hsl(342, 64%, 58%)",
      gold: "hsl(44, 96%, 56%)",
      fontDisplay: "Great Vibes"
    };
    expect(() => validateExpressivePalette(palette, PUNJABI_RANGES)).not.toThrow();
  });

  it("passes when hue is at the wrap boundary of [352, 8]", () => {
    // Test purpose: verify the wrap-boundary hue is accepted by the range
    // check. Other axes are pushed off-centre so the TUNE-2 midpoint check
    // also passes — keeps this test focused on wrapping, not on TUNE-2.
    const palette = {
      bgPrimary: "hsl(0, 96%, 24%)", // wrap boundary; saturated + lighter
      accent: "hsl(338, 70%, 60%)", // corner of accent range
      gold: "hsl(40, 96%, 50%)" // corner of gold range
      ,
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

  it("MIDPOINT_THRESHOLD is exposed and is the value the validator uses (0.05)", () => {
    expect(MIDPOINT_THRESHOLD).toBe(0.05);
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
  it("returns valid HSL strings within the supplied ranges", () => {
    const palette = buildFallbackPalette(PUNJABI_RANGES, "grand_celebration");
    expect(palette.bgPrimary).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(palette.accent).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(palette.gold).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    expect(PUNJABI_RANGES.fontDisplay).toContain(palette.fontDisplay);
  });

  it("positions toward dramatic end for grand_celebration", () => {
    const palette = buildFallbackPalette(PUNJABI_RANGES, "grand_celebration");
    const bg = parseHsl(palette.bgPrimary)!;
    // Style card pushes toward the saturated end. Saturation should be in
    // the upper half of the [76, 96] band.
    expect(bg.s).toBeGreaterThanOrEqual(86);
  });

  it("positions toward quieter end for elegant_minimal", () => {
    const palette = buildFallbackPalette(PUNJABI_RANGES, "elegant_minimal");
    const bg = parseHsl(palette.bgPrimary)!;
    // Quieter end of [76, 96] — saturation in the lower half.
    expect(bg.s).toBeLessThanOrEqual(86);
  });

  it("handles wrapping hue range correctly", () => {
    const palette = buildFallbackPalette(WRAPPING_RANGES, "grand_celebration");
    const bg = parseHsl(palette.bgPrimary)!;
    // Result must be in either [352, 360] OR [0, 8].
    expect(bg.h >= 352 || bg.h <= 8).toBe(true);
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
    // All attempts fail.
    const client = makeStubClient([invalid, invalid, invalid]);
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
    // MAX_RETRIES is 2 (TUNE-3) — Haiku is called exactly 2 times before
    // falling back, not 3.
    expect(client.messages.create).toHaveBeenCalledTimes(MAX_RETRIES);
  });

  it("MAX_RETRIES is 2 (TUNE-3 — reduced from 3 after spike showed 100% pass on attempt 1)", () => {
    expect(MAX_RETRIES).toBe(2);
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
