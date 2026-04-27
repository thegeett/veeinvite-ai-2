/**
 * Haiku HSL Spike v2 — F6 / AC #19 of PALETTE-03.
 *
 * Re-runs the Phase 2 spike against the PRODUCTION pre-call module — same
 * 29 test cases, same model — to measure whether the TUNE-1 prompt block
 * + TUNE-2 validator + retry loop drops the midpoint-clustering rate
 * below 30% (vs. the baseline 86%).
 *
 * Run:
 *   npx tsx scripts/spike-haiku-hsl-v2.ts
 *
 * Cost: up to ~58 calls (29 cases × MAX_RETRIES=2) × ~$0.0003 = ~$0.02.
 *
 * Differences from the original spike:
 *   - Imports `buildPalettePrompt` / `validateExpressivePalette` / etc.
 *     from the production module — TUNE-1 block is built-in.
 *   - Runs a real retry loop with the correction block (matches what
 *     production does), so we measure user-facing diversity.
 *   - Records final-attempt status (ok / fallback) and which attempt
 *     produced the winning palette, so we can spot if TUNE-2 is firing.
 *
 * Output: doc/spikes/2026-04-27-haiku-hsl-spike-v2.md
 *
 * The original spike script is untouched and remains the baseline.
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

import {
  buildPalettePrompt,
  distanceToMidpoint,
  parseHsl,
  validateExpressivePalette,
  MAX_RETRIES,
  MIDPOINT_THRESHOLD,
  PaletteError,
  type ExpressivePaletteRanges
} from "../src/lib/ai/prePaletteCall";
import {
  getCulturePaletteRanges,
  getWesternFamily,
  type WesternPaletteFamily
} from "../src/lib/cultural/library";
import type { ExpressivePalette } from "../src/lib/types";

// ----------------------------------------------------------------------------
// Env loading (mirror of the original spike — tsx is not Next.js)
// ----------------------------------------------------------------------------

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
const MODEL = process.env.HAIKU_MODEL ?? "claude-haiku-4-5-20251001";

// ----------------------------------------------------------------------------
// Test cases — same 29 as the baseline spike, kept verbatim for A/B fairness
// ----------------------------------------------------------------------------

interface TestCase {
  id: string;
  cultureId: string;
  subRegion?: string;
  cultureName: string;
  styleCard: string;
  vibeTags: string[];
}

const TEST_CASES: TestCase[] = [
  { id: "west-botanical", cultureId: "western", cultureName: "Western", styleCard: "romantic_traditional", vibeTags: ["romantic", "soft"] },
  { id: "west-dark-romance", cultureId: "western", cultureName: "Western", styleCard: "romantic_traditional", vibeTags: ["dramatic", "moody"] },
  { id: "west-coastal", cultureId: "western", cultureName: "Western", styleCard: "destination_glamour", vibeTags: ["coastal"] },
  { id: "west-editorial", cultureId: "western", cultureName: "Western", styleCard: "editorial_bold", vibeTags: ["bold", "modern"] },
  { id: "west-warm-rustic", cultureId: "western", cultureName: "Western", styleCard: "bohemian_garden", vibeTags: ["rustic", "natural"] },
  { id: "west-french-luxury", cultureId: "western", cultureName: "Western", styleCard: "elegant_minimal", vibeTags: ["elegant", "intimate"] },
  { id: "west-midnight-glamour", cultureId: "western", cultureName: "Western", styleCard: "destination_glamour", vibeTags: ["glamorous"] },
  { id: "west-scandi", cultureId: "western", cultureName: "Western", styleCard: "modern_minimalist", vibeTags: ["modern"] },

  { id: "hindu-default", cultureId: "hindu_indian", cultureName: "Hindu Indian", styleCard: "grand_celebration", vibeTags: ["grand", "festive"] },
  { id: "hindu-punjabi", cultureId: "hindu_indian", subRegion: "punjabi", cultureName: "Hindu — Punjabi", styleCard: "grand_celebration", vibeTags: ["grand"] },
  { id: "hindu-tamil", cultureId: "hindu_indian", subRegion: "tamil", cultureName: "Hindu — Tamil", styleCard: "grand_celebration", vibeTags: ["traditional"] },
  { id: "hindu-bengali", cultureId: "hindu_indian", subRegion: "bengali", cultureName: "Hindu — Bengali", styleCard: "romantic_traditional", vibeTags: ["traditional", "intimate"] },
  { id: "hindu-gujarati", cultureId: "hindu_indian", subRegion: "gujarati", cultureName: "Hindu — Gujarati", styleCard: "grand_celebration", vibeTags: ["festive"] },
  { id: "hindu-kerala", cultureId: "hindu_indian", subRegion: "kerala_malayali", cultureName: "Hindu — Kerala/Malayali", styleCard: "elegant_minimal", vibeTags: ["elegant", "refined"] },
  { id: "hindu-marwari", cultureId: "hindu_indian", subRegion: "marwari_rajasthani", cultureName: "Hindu — Marwari/Rajasthani", styleCard: "grand_celebration", vibeTags: ["grand", "vibrant"] },
  { id: "hindu-jain", cultureId: "hindu_indian", subRegion: "jain", cultureName: "Hindu — Jain", styleCard: "elegant_minimal", vibeTags: ["refined"] },

  { id: "muslim-sa", cultureId: "muslim", subRegion: "south_asian_muslim", cultureName: "Muslim — South Asian", styleCard: "grand_celebration", vibeTags: ["grand", "traditional"] },
  { id: "muslim-arab", cultureId: "muslim", subRegion: "arab_muslim", cultureName: "Muslim — Arab", styleCard: "elegant_minimal", vibeTags: ["elegant"] },
  { id: "muslim-wa", cultureId: "muslim", subRegion: "west_african_muslim", cultureName: "Muslim — West African", styleCard: "grand_celebration", vibeTags: ["festive", "vibrant"] },

  { id: "sikh", cultureId: "sikh", cultureName: "Sikh", styleCard: "grand_celebration", vibeTags: ["traditional"] },
  { id: "chinese", cultureId: "chinese", cultureName: "Chinese", styleCard: "grand_celebration", vibeTags: ["festive"] },
  { id: "jewish", cultureId: "jewish", cultureName: "Jewish", styleCard: "romantic_traditional", vibeTags: ["traditional", "intimate"] },
  { id: "yoruba", cultureId: "nigerian_yoruba", cultureName: "Nigerian — Yoruba", styleCard: "grand_celebration", vibeTags: ["vibrant", "festive"] },
  { id: "igbo", cultureId: "nigerian_igbo", cultureName: "Nigerian — Igbo", styleCard: "grand_celebration", vibeTags: ["grand"] },
  { id: "latin", cultureId: "latin_american_catholic", cultureName: "Latin American Catholic", styleCard: "romantic_traditional", vibeTags: ["festive", "elegant"] },

  { id: "hindu-punjabi-v2", cultureId: "hindu_indian", subRegion: "punjabi", cultureName: "Hindu — Punjabi", styleCard: "elegant_minimal", vibeTags: ["intimate", "refined"] },
  { id: "hindu-tamil-v2", cultureId: "hindu_indian", subRegion: "tamil", cultureName: "Hindu — Tamil", styleCard: "elegant_minimal", vibeTags: ["contemporary"] },
  { id: "muslim-arab-v2", cultureId: "muslim", subRegion: "arab_muslim", cultureName: "Muslim — Arab", styleCard: "grand_celebration", vibeTags: ["festive"] },
  { id: "west-botanical-v2", cultureId: "western", cultureName: "Western", styleCard: "romantic_traditional", vibeTags: ["natural", "intimate"] }
];

// Western style → family default (matches the baseline spike's table so
// each test resolves to the same family it did in the baseline run).
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

function rangesForTest(tc: TestCase): ExpressivePaletteRanges | null {
  if (tc.cultureId === "western") {
    const familyId =
      WESTERN_FAMILY_BY_TEST_ID[tc.id] ?? WESTERN_STYLE_TO_FAMILY[tc.styleCard];
    if (!familyId) return null;
    const family = getWesternFamily(familyId);
    if (!family) return null;
    return adaptFamilyToRanges(family, `western/${familyId}`);
  }
  const cultural = getCulturePaletteRanges(tc.cultureId, tc.subRegion);
  if (!cultural) return null;
  const tag = tc.subRegion ? `${tc.cultureId}/${tc.subRegion}` : tc.cultureId;
  return { ...cultural, source: tag };
}

// ----------------------------------------------------------------------------
// Run loop — mirrors runPalettePreCall but instruments each attempt
// ----------------------------------------------------------------------------

interface AttemptRecord {
  attempt: number;
  raw: string;
  parsed: ExpressivePalette | null;
  validated: boolean;
  error: string | null;
  midpointDistance: number; // 0 if not validated
}

interface Result {
  testId: string;
  cultureName: string;
  source: string;
  styleCard: string;
  vibeTags: string[];
  attempts: AttemptRecord[];
  finalPalette: ExpressivePalette | null;
  finalDistance: number;
  finalSource: "ok-attempt-1" | "ok-attempt-2" | "fallback" | "error";
  totalLatencyMs: number;
}

function midpointDistanceFor(
  palette: ExpressivePalette,
  ranges: ExpressivePaletteRanges
): number {
  const bg = parseHsl(palette.bgPrimary);
  const ac = parseHsl(palette.accent);
  const gd = parseHsl(palette.gold);
  if (!bg || !ac || !gd) return 0;
  return (
    (distanceToMidpoint(bg, ranges.bgPrimary) +
      distanceToMidpoint(ac, ranges.accent) +
      distanceToMidpoint(gd, ranges.gold)) /
    3
  );
}

async function runOne(tc: TestCase): Promise<Result> {
  const ranges = rangesForTest(tc);
  if (!ranges) {
    return {
      testId: tc.id,
      cultureName: tc.cultureName,
      source: "missing",
      styleCard: tc.styleCard,
      vibeTags: tc.vibeTags,
      attempts: [],
      finalPalette: null,
      finalDistance: 0,
      finalSource: "error",
      totalLatencyMs: 0
    };
  }

  const start = Date.now();
  const attempts: AttemptRecord[] = [];
  let lastError: PaletteError | null = null;
  let validated: ExpressivePalette | null = null;
  let finalSource: Result["finalSource"] = "error";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const prompt = buildPalettePrompt({
      ranges,
      styleCard: tc.styleCard,
      vibeTags: tc.vibeTags,
      cultureName: tc.cultureName,
      lastError,
      attempt
    });

    let raw = "";
    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }]
      });
      const block = resp.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      raw = block?.text ?? "";
    } catch (err) {
      attempts.push({
        attempt,
        raw: `[API ERROR] ${(err as Error).message}`,
        parsed: null,
        validated: false,
        error: (err as Error).message,
        midpointDistance: 0
      });
      break;
    }

    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first < 0 || last <= first) {
      lastError = new PaletteError("no JSON object found", raw);
      attempts.push({
        attempt,
        raw,
        parsed: null,
        validated: false,
        error: lastError.message,
        midpointDistance: 0
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(first, last + 1));
    } catch (err) {
      lastError = new PaletteError(
        `JSON parse: ${(err as Error).message}`,
        raw
      );
      attempts.push({
        attempt,
        raw,
        parsed: null,
        validated: false,
        error: lastError.message,
        midpointDistance: 0
      });
      continue;
    }

    try {
      const ok = validateExpressivePalette(parsed, ranges);
      validated = ok;
      finalSource = attempt === 1 ? "ok-attempt-1" : "ok-attempt-2";
      attempts.push({
        attempt,
        raw,
        parsed: ok,
        validated: true,
        error: null,
        midpointDistance: midpointDistanceFor(ok, ranges)
      });
      break;
    } catch (err) {
      if (err instanceof PaletteError) {
        lastError = err;
        const partial = parsed as Partial<ExpressivePalette>;
        attempts.push({
          attempt,
          raw,
          parsed: null,
          validated: false,
          error: err.message,
          midpointDistance:
            partial.bgPrimary && partial.accent && partial.gold
              ? midpointDistanceFor(partial as ExpressivePalette, ranges)
              : 0
        });
        continue;
      }
      throw err;
    }
  }

  if (!validated) {
    finalSource = "fallback";
  }

  return {
    testId: tc.id,
    cultureName: tc.cultureName,
    source: ranges.source,
    styleCard: tc.styleCard,
    vibeTags: tc.vibeTags,
    attempts,
    finalPalette: validated,
    finalDistance: validated ? midpointDistanceFor(validated, ranges) : 0,
    finalSource,
    totalLatencyMs: Date.now() - start
  };
}

// ----------------------------------------------------------------------------
// Aggregation + report
// ----------------------------------------------------------------------------

function aggregate(results: Result[]) {
  const total = results.length;
  const validated = results.filter((r) => r.finalPalette !== null);
  const okOnFirst = results.filter((r) => r.finalSource === "ok-attempt-1").length;
  const okOnRetry = results.filter((r) => r.finalSource === "ok-attempt-2").length;
  const fallback = results.filter((r) => r.finalSource === "fallback").length;
  const errored = results.filter((r) => r.finalSource === "error").length;

  // Headline: midpoint clustering rate among VALIDATED outputs
  const clustered = validated.filter((r) => r.finalDistance < 0.1).length;
  const clusteringRate = validated.length > 0 ? clustered / validated.length : 0;
  const meanDistance =
    validated.length > 0
      ? validated.reduce((sum, r) => sum + r.finalDistance, 0) / validated.length
      : 0;

  // How often did TUNE-2 fire? (any attempt that failed with "too close to midpoints")
  const tune2Fires = results.reduce(
    (sum, r) =>
      sum +
      r.attempts.filter((a) => (a.error ?? "").includes("midpoint")).length,
    0
  );

  const meanLatencyMs =
    results.reduce((sum, r) => sum + r.totalLatencyMs, 0) / total;

  return {
    total,
    okOnFirst,
    okOnRetry,
    fallback,
    errored,
    clustered,
    clusteringRate,
    meanDistance,
    tune2Fires,
    meanLatencyMs
  };
}

function writeReport(results: Result[], agg: ReturnType<typeof aggregate>) {
  const dir = path.resolve(process.cwd(), "doc/spikes");
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, "2026-04-27-haiku-hsl-spike-v2.md");

  const baselinePath = path.join(dir, "2026-04-27-haiku-hsl-spike.md");
  const baselineRef = fs.existsSync(baselinePath)
    ? `Baseline report (pre-Phase-3 prompt + no validator-side TUNE-2): \`doc/spikes/2026-04-27-haiku-hsl-spike.md\``
    : "Baseline report not found at expected location.";

  const lines: string[] = [];
  lines.push("# Haiku HSL Spike v2 — post-Phase-3 measurement");
  lines.push("");
  lines.push(`**Run date:** ${new Date().toISOString()}`);
  lines.push(`**Model:** ${MODEL}`);
  lines.push(`**N test cases:** ${agg.total}`);
  lines.push(`**MAX_RETRIES:** ${MAX_RETRIES}  **MIDPOINT_THRESHOLD:** ${MIDPOINT_THRESHOLD}`);
  lines.push("");
  lines.push(baselineRef);
  lines.push("");

  lines.push("## Headline metrics");
  lines.push("");
  lines.push(`| Metric | Value | Baseline (Phase 2) | Target |`);
  lines.push(`|---|---|---|---|`);
  lines.push(
    `| Midpoint clustering rate (final palette within 0.1 of midpoint) | **${(agg.clusteringRate * 100).toFixed(0)}%** | 86% | < 30% |`
  );
  lines.push(
    `| Mean midpoint distance (validated palettes) | ${agg.meanDistance.toFixed(3)} | ~0.089 | higher = more diverse |`
  );
  lines.push(
    `| OK on attempt 1 | ${agg.okOnFirst} / ${agg.total} | 29 / 29 | retries are extra cost |`
  );
  lines.push(
    `| OK on attempt 2 (retry honoured TUNE-2 correction) | ${agg.okOnRetry} / ${agg.total} | n/a | proves correction loop works |`
  );
  lines.push(
    `| Fallback to library palette | ${agg.fallback} / ${agg.total} | 0 / 29 | should stay near 0 |`
  );
  lines.push(
    `| TUNE-2 rejections triggered (any attempt) | ${agg.tune2Fires} | n/a | shows the validator is doing work |`
  );
  lines.push(`| Mean total latency (incl. retries) | ${agg.meanLatencyMs.toFixed(0)} ms | ~600 ms | |`);
  lines.push("");

  lines.push("## Verdict");
  lines.push("");
  if (agg.clusteringRate < 0.3) {
    lines.push(
      `**PASS — clustering rate ${(agg.clusteringRate * 100).toFixed(0)}% is below the 30% target.** TUNE-1 (anti-clustering prompt block) plus TUNE-2 (midpoint-distance validator) successfully break the wedding-default training prior.`
    );
  } else {
    lines.push(
      `**REVIEW — clustering rate ${(agg.clusteringRate * 100).toFixed(0)}% is above the 30% target.** Investigate whether MIDPOINT_THRESHOLD needs tightening, or whether specific cultures dominate the cluster.`
    );
  }
  lines.push("");

  lines.push("## Per-test results");
  lines.push("");
  lines.push("| Test | Source | Final attempt | Final distance | Notes |");
  lines.push("|---|---|---|---|---|");
  for (const r of results) {
    const notes = r.attempts
      .map((a) => {
        if (a.validated) return `attempt ${a.attempt}: ok (d=${a.midpointDistance.toFixed(3)})`;
        const reason = (a.error ?? "").includes("midpoint")
          ? "TUNE-2 reject"
          : (a.error ?? "").slice(0, 60);
        return `attempt ${a.attempt}: ${reason}`;
      })
      .join(" → ");
    lines.push(
      `| ${r.testId} | ${r.source} | ${r.finalSource} | ${r.finalDistance.toFixed(3)} | ${notes} |`
    );
  }
  lines.push("");

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  return outPath;
}

async function main() {
  console.log(`Running spike v2 against ${MODEL} — ${TEST_CASES.length} cases.`);
  console.log(`MAX_RETRIES=${MAX_RETRIES}, MIDPOINT_THRESHOLD=${MIDPOINT_THRESHOLD}`);
  console.log("");

  const results: Result[] = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    process.stdout.write(`[${i + 1}/${TEST_CASES.length}] ${tc.id} ... `);
    const r = await runOne(tc);
    results.push(r);
    const dist = r.finalDistance.toFixed(3);
    process.stdout.write(`${r.finalSource} (d=${dist}, ${r.totalLatencyMs}ms)\n`);
  }

  const agg = aggregate(results);
  const out = writeReport(results, agg);
  console.log("");
  console.log(`Clustering rate: ${(agg.clusteringRate * 100).toFixed(0)}% (target < 30%)`);
  console.log(`Mean distance:   ${agg.meanDistance.toFixed(3)}`);
  console.log(`Fallbacks:       ${agg.fallback}/${agg.total}`);
  console.log(`Report:          ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
