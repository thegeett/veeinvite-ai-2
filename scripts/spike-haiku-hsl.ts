/**
 * Haiku HSL Confidence Spike — PALETTE-02 (investigation, not production code).
 *
 * Runs ~30 prompts against Haiku 4.5 with the library's HSL ranges injected,
 * captures raw output, validates per the PRECALL_IMPLEMENTATION_SPEC validator,
 * and writes a markdown report at doc/spikes/2026-04-27-haiku-hsl-spike.md.
 *
 * Run:
 *   npx tsx scripts/spike-haiku-hsl.ts
 *
 * Cost: ~30 calls × ~$0.0003 each = ~$0.01 total against Haiku 4.5.
 *
 * The script is intentionally self-contained — it does not import from
 * src/lib/. Future PRs (PALETTE-03) will lift these helpers into a real
 * module. Keeping the spike standalone makes it discardable.
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// Env loading — read .env.local manually since we're not in Next.js
// ============================================================================

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set. Add it to .env.local or export it.");
  process.exit(1);
}

const client = new Anthropic({ apiKey });

// Hardcoded default; override with HAIKU_MODEL=claude-haiku-4-6-...
// to re-run this spike against newer Haiku releases without editing the file.
const MODEL = process.env.HAIKU_MODEL ?? "claude-haiku-4-5-20251001";

// ============================================================================
// Library reader — local copy, not imported from src/
// ============================================================================

interface HslRange {
  h: [number, number];
  s: [number, number];
  l: [number, number];
  note: string;
}

interface CulturePaletteRanges {
  bgPrimary: HslRange;
  accent: HslRange;
  gold: HslRange;
  fontDisplay: string[];
  source: string; // e.g. "hindu_indian/punjabi" — for the report
}

interface WesternFamily {
  label: string;
  description?: string;
  bgPrimary: HslRange;
  accent: HslRange;
  gold: HslRange;
  fontDisplay: string[];
}

const libraryPath = path.resolve(
  process.cwd(),
  "src/lib/cultural-content-library.json"
);
const library = JSON.parse(fs.readFileSync(libraryPath, "utf8")) as {
  cultures: Record<string, any>;
};

function getCulturePaletteRanges(
  cultureId: string,
  subRegion?: string
): CulturePaletteRanges | null {
  const culture = library.cultures[cultureId];
  if (!culture?.colorPalette) return null;
  if (cultureId === "western") return null;

  const palette = culture.colorPalette;

  if (subRegion && palette.subRegions?.[subRegion]) {
    const sub = palette.subRegions[subRegion];
    return {
      bgPrimary: sub.bgPrimary,
      accent: sub.accent,
      gold: sub.gold,
      fontDisplay: sub.fontDisplay ?? palette.default.fontDisplay,
      source: `${cultureId}/${subRegion}`
    };
  }

  return {
    bgPrimary: palette.default.bgPrimary,
    accent: palette.default.accent,
    gold: palette.default.gold,
    fontDisplay: palette.default.fontDisplay,
    source: cultureId
  };
}

function getWesternFamily(familyId: string): WesternFamily | null {
  const western = library.cultures.western;
  const family = western?.colorPalette?.families?.[familyId];
  return family ?? null;
}

// ============================================================================
// Prompt builder — straight from PRECALL_IMPLEMENTATION_SPEC.md Step 3
// ============================================================================

function buildPrompt(
  ranges: CulturePaletteRanges | (WesternFamily & { source: string }),
  styleCard: string,
  vibeTags: string[],
  cultureName: string
): string {
  return `You are picking exact colors for a wedding invitation.
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
// Validator — straight from PRECALL_IMPLEMENTATION_SPEC.md Step 4
// ============================================================================

const HSL_PATTERN = /^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/;

function parseHsl(value: string): { h: number; s: number; l: number } | null {
  const match = value.trim().match(HSL_PATTERN);
  if (!match) return null;
  return {
    h: parseInt(match[1], 10),
    s: parseInt(match[2], 10),
    l: parseInt(match[3], 10)
  };
}

function hueInRange(h: number, range: [number, number]): boolean {
  if (range[0] <= range[1]) return h >= range[0] && h <= range[1];
  return h >= range[0] || h <= range[1];
}

interface ValidationOutcome {
  format: "pass" | "fail";
  range: "pass" | "fail" | "n/a";
  fontApproved: "pass" | "fail" | "n/a";
  midpointDistance: number; // Euclidean distance in HSL space, normalized 0-1
  failReason?: string;
}

function rangeMidpoint(range: HslRange): { h: number; s: number; l: number } {
  let h: number;
  if (range.h[0] <= range.h[1]) {
    h = (range.h[0] + range.h[1]) / 2;
  } else {
    const span = 360 - range.h[0] + range.h[1];
    const raw = range.h[0] + span / 2;
    h = raw >= 360 ? raw - 360 : raw;
  }
  return {
    h,
    s: (range.s[0] + range.s[1]) / 2,
    l: (range.l[0] + range.l[1]) / 2
  };
}

function distanceToMidpoint(
  picked: { h: number; s: number; l: number },
  range: HslRange
): number {
  const mid = rangeMidpoint(range);
  // Use shortest hue distance (account for wrap)
  const hueDelta = Math.min(
    Math.abs(picked.h - mid.h),
    360 - Math.abs(picked.h - mid.h)
  );
  // Normalize each axis: hue 0-180 max, sat/light 0-100 max
  const dh = hueDelta / 180;
  const ds = Math.abs(picked.s - mid.s) / 100;
  const dl = Math.abs(picked.l - mid.l) / 100;
  return Math.sqrt(dh * dh + ds * ds + dl * dl);
}

function validate(
  raw: string,
  ranges: CulturePaletteRanges | (WesternFamily & { source: string })
): ValidationOutcome {
  // Extract the JSON object from the raw response
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return {
      format: "fail",
      range: "n/a",
      fontApproved: "n/a",
      midpointDistance: 0,
      failReason: "no JSON object found in response"
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  } catch (err) {
    return {
      format: "fail",
      range: "n/a",
      fontApproved: "n/a",
      midpointDistance: 0,
      failReason: `JSON parse error: ${(err as Error).message}`
    };
  }

  // Validate each field is a string
  for (const k of ["bgPrimary", "accent", "gold", "fontDisplay"] as const) {
    if (typeof parsed[k] !== "string") {
      return {
        format: "fail",
        range: "n/a",
        fontApproved: "n/a",
        midpointDistance: 0,
        failReason: `field "${k}" missing or not a string`
      };
    }
  }

  // Validate HSL format
  const bg = parseHsl(parsed.bgPrimary as string);
  const ac = parseHsl(parsed.accent as string);
  const gd = parseHsl(parsed.gold as string);
  if (!bg || !ac || !gd) {
    return {
      format: "fail",
      range: "n/a",
      fontApproved: "n/a",
      midpointDistance: 0,
      failReason: `not in hsl(H, S%, L%) format — bg:${parsed.bgPrimary} ac:${parsed.accent} gd:${parsed.gold}`
    };
  }

  // Validate each is in range
  const checks = [
    { name: "bgPrimary", parsed: bg, range: ranges.bgPrimary },
    { name: "accent", parsed: ac, range: ranges.accent },
    { name: "gold", parsed: gd, range: ranges.gold }
  ];
  for (const c of checks) {
    if (!hueInRange(c.parsed.h, c.range.h)) {
      return {
        format: "pass",
        range: "fail",
        fontApproved: "n/a",
        midpointDistance: 0,
        failReason: `${c.name} hue ${c.parsed.h} outside [${c.range.h[0]}, ${c.range.h[1]}]`
      };
    }
    if (c.parsed.s < c.range.s[0] || c.parsed.s > c.range.s[1]) {
      return {
        format: "pass",
        range: "fail",
        fontApproved: "n/a",
        midpointDistance: 0,
        failReason: `${c.name} saturation ${c.parsed.s}% outside [${c.range.s[0]}%, ${c.range.s[1]}%]`
      };
    }
    if (c.parsed.l < c.range.l[0] || c.parsed.l > c.range.l[1]) {
      return {
        format: "pass",
        range: "fail",
        fontApproved: "n/a",
        midpointDistance: 0,
        failReason: `${c.name} lightness ${c.parsed.l}% outside [${c.range.l[0]}%, ${c.range.l[1]}%]`
      };
    }
  }

  // Validate font is approved
  const font = (parsed.fontDisplay as string).toLowerCase();
  const approved = ranges.fontDisplay.map((f) => f.toLowerCase());
  if (!approved.includes(font)) {
    return {
      format: "pass",
      range: "pass",
      fontApproved: "fail",
      midpointDistance: 0,
      failReason: `fontDisplay "${parsed.fontDisplay}" not in approved list: ${ranges.fontDisplay.join(", ")}`
    };
  }

  // Compute midpoint clustering — average distance across the 3 colors
  const avgDist =
    (distanceToMidpoint(bg, ranges.bgPrimary) +
      distanceToMidpoint(ac, ranges.accent) +
      distanceToMidpoint(gd, ranges.gold)) /
    3;

  return {
    format: "pass",
    range: "pass",
    fontApproved: "pass",
    midpointDistance: avgDist
  };
}

// ============================================================================
// Test cases — 30 varied across cultures × style cards × vibe tags
// ============================================================================

interface TestCase {
  id: string;
  cultureId: string;
  subRegion?: string;
  cultureName: string;
  styleCard: string;
  vibeTags: string[];
}

const TEST_CASES: TestCase[] = [
  // 8 western families — one case each, varying style + vibe
  { id: "west-botanical", cultureId: "western", cultureName: "Western", styleCard: "romantic_traditional", vibeTags: ["romantic", "soft"] },
  { id: "west-dark-romance", cultureId: "western", cultureName: "Western", styleCard: "romantic_traditional", vibeTags: ["dramatic", "moody"] },
  { id: "west-coastal", cultureId: "western", cultureName: "Western", styleCard: "destination_glamour", vibeTags: ["coastal"] },
  { id: "west-editorial", cultureId: "western", cultureName: "Western", styleCard: "editorial_bold", vibeTags: ["bold", "modern"] },
  { id: "west-warm-rustic", cultureId: "western", cultureName: "Western", styleCard: "bohemian_garden", vibeTags: ["rustic", "natural"] },
  { id: "west-french-luxury", cultureId: "western", cultureName: "Western", styleCard: "elegant_minimal", vibeTags: ["elegant", "intimate"] },
  { id: "west-midnight-glamour", cultureId: "western", cultureName: "Western", styleCard: "destination_glamour", vibeTags: ["glamorous"] },
  { id: "west-scandi", cultureId: "western", cultureName: "Western", styleCard: "modern_minimalist", vibeTags: ["modern"] },

  // 7 Hindu sub-regions + 1 default = 8 Hindu cases
  { id: "hindu-default", cultureId: "hindu_indian", cultureName: "Hindu Indian", styleCard: "grand_celebration", vibeTags: ["grand", "festive"] },
  { id: "hindu-punjabi", cultureId: "hindu_indian", subRegion: "punjabi", cultureName: "Hindu — Punjabi", styleCard: "grand_celebration", vibeTags: ["grand"] },
  { id: "hindu-tamil", cultureId: "hindu_indian", subRegion: "tamil", cultureName: "Hindu — Tamil", styleCard: "grand_celebration", vibeTags: ["traditional"] },
  { id: "hindu-bengali", cultureId: "hindu_indian", subRegion: "bengali", cultureName: "Hindu — Bengali", styleCard: "romantic_traditional", vibeTags: ["traditional", "intimate"] },
  { id: "hindu-gujarati", cultureId: "hindu_indian", subRegion: "gujarati", cultureName: "Hindu — Gujarati", styleCard: "grand_celebration", vibeTags: ["festive"] },
  { id: "hindu-kerala", cultureId: "hindu_indian", subRegion: "kerala_malayali", cultureName: "Hindu — Kerala/Malayali", styleCard: "elegant_minimal", vibeTags: ["elegant", "refined"] },
  { id: "hindu-marwari", cultureId: "hindu_indian", subRegion: "marwari_rajasthani", cultureName: "Hindu — Marwari/Rajasthani", styleCard: "grand_celebration", vibeTags: ["grand", "vibrant"] },
  { id: "hindu-jain", cultureId: "hindu_indian", subRegion: "jain", cultureName: "Hindu — Jain", styleCard: "elegant_minimal", vibeTags: ["refined"] },

  // 3 Muslim sub-regions
  { id: "muslim-sa", cultureId: "muslim", subRegion: "south_asian_muslim", cultureName: "Muslim — South Asian", styleCard: "grand_celebration", vibeTags: ["grand", "traditional"] },
  { id: "muslim-arab", cultureId: "muslim", subRegion: "arab_muslim", cultureName: "Muslim — Arab", styleCard: "elegant_minimal", vibeTags: ["elegant"] },
  { id: "muslim-wa", cultureId: "muslim", subRegion: "west_african_muslim", cultureName: "Muslim — West African", styleCard: "grand_celebration", vibeTags: ["festive", "vibrant"] },

  // 1 each: Sikh, Chinese, Jewish, Nigerian-Yoruba, Nigerian-Igbo, Latin-Catholic
  { id: "sikh", cultureId: "sikh", cultureName: "Sikh", styleCard: "grand_celebration", vibeTags: ["traditional"] },
  { id: "chinese", cultureId: "chinese", cultureName: "Chinese", styleCard: "grand_celebration", vibeTags: ["festive"] },
  { id: "jewish", cultureId: "jewish", cultureName: "Jewish", styleCard: "romantic_traditional", vibeTags: ["traditional", "intimate"] },
  { id: "yoruba", cultureId: "nigerian_yoruba", cultureName: "Nigerian — Yoruba", styleCard: "grand_celebration", vibeTags: ["vibrant", "festive"] },
  { id: "igbo", cultureId: "nigerian_igbo", cultureName: "Nigerian — Igbo", styleCard: "grand_celebration", vibeTags: ["grand"] },
  { id: "latin", cultureId: "latin_american_catholic", cultureName: "Latin American Catholic", styleCard: "romantic_traditional", vibeTags: ["festive", "elegant"] },

  // 4 within-culture variation cases — same culture, different style+tags,
  // so we can see if Haiku gives DIFFERENT answers for the same constraints
  { id: "hindu-punjabi-v2", cultureId: "hindu_indian", subRegion: "punjabi", cultureName: "Hindu — Punjabi", styleCard: "elegant_minimal", vibeTags: ["intimate", "refined"] },
  { id: "hindu-tamil-v2", cultureId: "hindu_indian", subRegion: "tamil", cultureName: "Hindu — Tamil", styleCard: "elegant_minimal", vibeTags: ["contemporary"] },
  { id: "muslim-arab-v2", cultureId: "muslim", subRegion: "arab_muslim", cultureName: "Muslim — Arab", styleCard: "grand_celebration", vibeTags: ["festive"] },
  { id: "west-botanical-v2", cultureId: "western", cultureName: "Western", styleCard: "romantic_traditional", vibeTags: ["natural", "intimate"] }
];

// Map western style cards to families (subset of selectWesternFamily — we only
// need the deterministic style-card → family default for the spike's western
// cases, since vibe tags don't get re-scored here).
const WESTERN_STYLE_TO_FAMILY: Record<string, string> = {
  modern_minimalist: "scandinavian_clean",
  elegant_minimal: "french_luxury",
  romantic_traditional: "botanical_garden",
  bohemian_garden: "warm_rustic",
  destination_glamour: "midnight_glamour",
  editorial_bold: "editorial_minimal",
  grand_celebration: "midnight_glamour"
};

const WESTERN_FAMILY_BY_TEST_ID: Record<string, string> = {
  "west-botanical": "botanical_garden",
  "west-dark-romance": "dark_romance",
  "west-coastal": "coastal_destination",
  "west-editorial": "editorial_minimal",
  "west-warm-rustic": "warm_rustic",
  "west-french-luxury": "french_luxury",
  "west-midnight-glamour": "midnight_glamour",
  "west-scandi": "scandinavian_clean",
  "west-botanical-v2": "botanical_garden"
};

function rangesForTest(
  tc: TestCase
): { ranges: CulturePaletteRanges | (WesternFamily & { source: string }); familyOrSubRegion: string } | null {
  if (tc.cultureId === "western") {
    const familyId = WESTERN_FAMILY_BY_TEST_ID[tc.id] ?? WESTERN_STYLE_TO_FAMILY[tc.styleCard];
    const family = getWesternFamily(familyId);
    if (!family) return null;
    return {
      ranges: { ...family, source: `western/${familyId}` },
      familyOrSubRegion: familyId
    };
  }
  const cultural = getCulturePaletteRanges(tc.cultureId, tc.subRegion);
  if (!cultural) return null;
  return { ranges: cultural, familyOrSubRegion: tc.subRegion ?? "default" };
}

// ============================================================================
// Main loop — call Haiku, validate, collect results
// ============================================================================

interface Result {
  testId: string;
  cultureName: string;
  source: string;
  styleCard: string;
  vibeTags: string[];
  raw: string;
  outcome: ValidationOutcome;
  latencyMs: number;
}

async function runOne(tc: TestCase): Promise<Result> {
  const r = rangesForTest(tc);
  if (!r) {
    return {
      testId: tc.id,
      cultureName: tc.cultureName,
      source: "missing-ranges",
      styleCard: tc.styleCard,
      vibeTags: tc.vibeTags,
      raw: "",
      outcome: {
        format: "fail",
        range: "n/a",
        fontApproved: "n/a",
        midpointDistance: 0,
        failReason: "no ranges found in library"
      },
      latencyMs: 0
    };
  }

  const prompt = buildPrompt(r.ranges, tc.styleCard, tc.vibeTags, tc.cultureName);
  const start = Date.now();

  let raw = "";
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    });
    const textBlock = resp.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    raw = textBlock?.text ?? "";
  } catch (err) {
    raw = `[API ERROR] ${(err as Error).message}`;
  }

  const latencyMs = Date.now() - start;
  const outcome = raw.startsWith("[API ERROR]")
    ? {
        format: "fail" as const,
        range: "n/a" as const,
        fontApproved: "n/a" as const,
        midpointDistance: 0,
        failReason: raw
      }
    : validate(raw, r.ranges);

  return {
    testId: tc.id,
    cultureName: tc.cultureName,
    source: r.ranges.source,
    styleCard: tc.styleCard,
    vibeTags: tc.vibeTags,
    raw,
    outcome,
    latencyMs
  };
}

// ============================================================================
// Aggregation + report writer
// ============================================================================

function aggregate(results: Result[]) {
  const total = results.length;
  const formatPass = results.filter((r) => r.outcome.format === "pass").length;
  const rangePass = results.filter((r) => r.outcome.range === "pass").length;
  const fontApprovedPass = results.filter(
    (r) => r.outcome.fontApproved === "pass"
  ).length;
  const allPass = results.filter(
    (r) =>
      r.outcome.format === "pass" &&
      r.outcome.range === "pass" &&
      r.outcome.fontApproved === "pass"
  ).length;

  const passRate = allPass / total;
  const formatFails = results.filter((r) => r.outcome.format === "fail").length;
  const rangeFails = results.filter((r) => r.outcome.range === "fail").length;
  const fontFails = results.filter((r) => r.outcome.fontApproved === "fail").length;

  // Midpoint clustering — fraction of all-pass results within 0.1 of midpoint
  const passing = results.filter(
    (r) =>
      r.outcome.format === "pass" &&
      r.outcome.range === "pass" &&
      r.outcome.fontApproved === "pass"
  );
  const clustered = passing.filter((r) => r.outcome.midpointDistance < 0.1).length;
  const clusterRate = passing.length > 0 ? clustered / passing.length : 0;
  const avgMidpointDistance =
    passing.reduce((sum, r) => sum + r.outcome.midpointDistance, 0) /
    Math.max(passing.length, 1);

  const avgLatencyMs =
    results.reduce((sum, r) => sum + r.latencyMs, 0) / Math.max(total, 1);

  return {
    total,
    formatPass,
    rangePass,
    fontApprovedPass,
    allPass,
    passRate,
    formatFails,
    rangeFails,
    fontFails,
    clusterRate,
    avgMidpointDistance,
    avgLatencyMs
  };
}

function recommendation(agg: ReturnType<typeof aggregate>): {
  verdict: "SHIP" | "TUNE" | "PIVOT";
  reasoning: string;
} {
  if (agg.passRate < 0.8) {
    return {
      verdict: "PIVOT",
      reasoning: `Pass rate ${(agg.passRate * 100).toFixed(0)}% < 80%. The pre-call architecture as designed will hit the fallback path too often. Options: broaden HSL ranges in the library, switch the pre-call to Sonnet (16× cost), or move to a candidate-set selection model.`
    };
  }
  if (agg.passRate < 0.95) {
    return {
      verdict: "TUNE",
      reasoning: `Pass rate ${(agg.passRate * 100).toFixed(0)}% in [80%, 95%). Phase 3 can ship with prompt enhancements: add 2-3 worked examples to the prompt template, retain the 3-retry budget. Failure fan-out (format ${agg.formatFails}, range ${agg.rangeFails}, font ${agg.fontFails}) tells us where to focus the tuning.`
    };
  }
  if (agg.clusterRate > 0.3) {
    return {
      verdict: "TUNE",
      reasoning: `Pass rate ${(agg.passRate * 100).toFixed(0)}% is good, but ${(agg.clusterRate * 100).toFixed(0)}% of passing results cluster within 0.1 of the range midpoint. Diversity will be artificially low. Add an explicit "pick at least 20% from midpoint" instruction to the prompt; consider a midpoint-distance check in the validator.`
    };
  }
  return {
    verdict: "SHIP",
    reasoning: `Pass rate ${(agg.passRate * 100).toFixed(0)}% ≥ 95% and midpoint clustering at ${(agg.clusterRate * 100).toFixed(0)}% (< 30% threshold). Phase 3 proceeds as designed in PRECALL_IMPLEMENTATION_SPEC.md.`
  };
}

function writeReport(results: Result[], agg: ReturnType<typeof aggregate>) {
  const rec = recommendation(agg);
  const today = new Date().toISOString().slice(0, 10);

  const perCase = results
    .map((r) => {
      const status =
        r.outcome.format === "pass" &&
        r.outcome.range === "pass" &&
        r.outcome.fontApproved === "pass"
          ? "✅ pass"
          : `❌ ${r.outcome.failReason ?? "unknown"}`;
      const tags = r.vibeTags.length > 0 ? r.vibeTags.join(", ") : "(none)";
      return `### ${r.testId} — ${r.cultureName}

- **Source:** \`${r.source}\`
- **Style:** \`${r.styleCard}\`
- **Tags:** ${tags}
- **Latency:** ${r.latencyMs} ms
- **Result:** ${status}
- **Midpoint distance:** ${r.outcome.midpointDistance.toFixed(3)}

\`\`\`
${r.raw.slice(0, 400)}${r.raw.length > 400 ? "…" : ""}
\`\`\`
`;
    })
    .join("\n");

  const md = `# Haiku HSL Confidence Spike — ${today}

**Phase:** PALETTE-02 (investigation, not production code)
**Model:** \`${MODEL}\`
**Test cases:** ${agg.total}
**Total cost:** ~$${(agg.total * 0.0003).toFixed(4)}

## Recommendation

### **${rec.verdict}**

${rec.reasoning}

## Aggregate metrics

| Metric | Value |
|---|---|
| All-checks pass rate (format + range + font) | **${(agg.passRate * 100).toFixed(0)}%** (${agg.allPass}/${agg.total}) |
| Format pass rate (HSL string parses) | ${((agg.formatPass / agg.total) * 100).toFixed(0)}% (${agg.formatPass}/${agg.total}) |
| Range pass rate (within library bounds) | ${((agg.rangePass / agg.total) * 100).toFixed(0)}% (${agg.rangePass}/${agg.total}) |
| Font approved (one of culture's allowed list) | ${((agg.fontApprovedPass / agg.total) * 100).toFixed(0)}% (${agg.fontApprovedPass}/${agg.total}) |
| Midpoint clustering (passing results < 0.1 from midpoint) | ${(agg.clusterRate * 100).toFixed(0)}% |
| Avg midpoint distance (passing results) | ${agg.avgMidpointDistance.toFixed(3)} |
| Avg latency per call | ${agg.avgLatencyMs.toFixed(0)} ms |
| Format failures | ${agg.formatFails} |
| Range failures | ${agg.rangeFails} |
| Font failures | ${agg.fontFails} |

## Decision-gate thresholds (from PALETTE_DIVERSITY_TICKETS.md)

| Pass rate | Recommendation |
|---|---|
| ≥ 95% on attempt 1 | SHIP |
| 80–95% | TUNE |
| < 80% | PIVOT |
| Midpoint clustering > 30% (any pass rate) | TUNE |

## Per-test results

${perCase}

## Source

- Script: \`scripts/spike-haiku-hsl.ts\`
- Library used: \`src/lib/cultural-content-library.json\`
- Prompt template: per \`doc/PRECALL_IMPLEMENTATION_SPEC.md\` Step 3
- Validator: per \`doc/PRECALL_IMPLEMENTATION_SPEC.md\` Step 4
`;

  // Same-day re-runs: protect the original baseline by appending a HHMMSS
  // suffix when a report already exists. If you intend to overwrite (e.g.
  // updating after a prompt change), delete the old file first.
  const reportDir = path.resolve(process.cwd(), "doc/spikes");
  fs.mkdirSync(reportDir, { recursive: true });
  const baseName = `${today}-haiku-hsl-spike.md`;
  const basePath = path.join(reportDir, baseName);
  let reportPath = basePath;
  if (fs.existsSync(basePath)) {
    const now = new Date();
    const hhmmss = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    reportPath = path.join(reportDir, `${today}-haiku-hsl-spike-rerun-${hhmmss}.md`);
    console.log(`(baseline at ${basePath} kept; this run → ${reportPath})`);
  }
  fs.writeFileSync(reportPath, md, "utf8");
  console.log(`Report written: ${reportPath}`);
  console.log(`Verdict: ${rec.verdict}`);
}

// ============================================================================
// Entry point
// ============================================================================

async function main() {
  console.log(`Running ${TEST_CASES.length} cases against ${MODEL}...`);
  const results: Result[] = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    process.stdout.write(`[${i + 1}/${TEST_CASES.length}] ${tc.id}... `);
    const result = await runOne(tc);
    const verdict =
      result.outcome.format === "pass" &&
      result.outcome.range === "pass" &&
      result.outcome.fontApproved === "pass"
        ? "✓"
        : "✗";
    console.log(`${verdict} (${result.latencyMs} ms)`);
    results.push(result);
  }

  const agg = aggregate(results);
  writeReport(results, agg);
}

main().catch((err) => {
  console.error("Spike failed:", err);
  process.exit(1);
});
