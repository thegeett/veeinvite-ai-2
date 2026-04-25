// Anthropic SDK wrapper — plan §9, §12. Server-side only (architecture rule 10).
//
// Three exported async functions wrap the three prompt types:
//   - runCall2 → ThemeJSON (Sonnet 4.5)
//   - runCall3 → hero HTML string (Sonnet 4.5)
//   - runClassifier → AIEditClassification (Haiku 4.5)
//
// A JSON response may arrive wrapped in markdown code fences — `parseJsonResilient`
// strips them before parsing. On parse failure, return safe defaults and let the
// validator fill gaps (architecture rule 5 / §10).

import Anthropic from "@anthropic-ai/sdk";
import type {
  AIEditClassification,
  Call2Input,
  Call3Input,
  ClassifierInput,
  EditType,
  GlobalTokens,
  HeroJsonEnvelope,
  ThemeJSON
} from "@/lib/types";
import { CONTENT_DEFAULTS } from "@/lib/types";
import {
  buildCall2Prompt,
  buildCall3Prompt,
  buildClassifierPrompt
} from "./prompt";
import { validateCall2Json } from "./validateCall2Json";
import {
  extractHeroJson,
  HeroExtractionError
} from "@/lib/renderer/extractHeroJson";
import { validateHeroJson } from "@/lib/renderer/validateHeroJson";
import { buildHeroFromJson } from "@/lib/renderer/buildHeroFromJson";
import { buildFallbackEnvelope } from "@/lib/renderer/fallbackHero";

const MODEL_SONNET = "claude-sonnet-4-5";
const MODEL_HAIKU = "claude-haiku-4-5-20251001";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required. AI calls are server-only (architecture rule 10)."
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

// Allow tests (or a Stream C integration test) to inject a stub client.
export function __setClientForTesting(client: Anthropic | null): void {
  cachedClient = client;
}

// ---------- Hero HTML extractor --------------------------------------------
//
// Claude sometimes wraps hero HTML in markdown fences (```html ... ```),
// prepends a sentence of prose ("Here is the hero section:"), or appends a
// closing remark. Any of these bleeding into the rendered page shows as
// literal text, and a stray ``` can also break the following <script>'s
// parsing — which is why "nav not working" commonly co-occurs with a visible
// ```html leak.
//
// This extractor:
//   1. Finds the first ``` fence — if present, slices to the next ```.
//   2. Otherwise trims prose before the first <section / <div.
//   3. Trims anything after the last </section>, </div>, </style>, or </script>.
//      (Claude sometimes emits <style> and <script> as siblings of the hero
//      section — those MUST be kept, not trimmed.)
//   4. Removes stray ``` anywhere in the result (belt-and-braces).

export function extractHeroHtml(raw: string): string {
  let text = raw.trim();

  // Case 1: markdown fence — extract the inner block.
  const fenceStart = text.match(/```(?:html|HTML)?\s*\n?/);
  if (fenceStart && fenceStart.index !== undefined) {
    const afterOpen = fenceStart.index + fenceStart[0].length;
    const fenceEnd = text.indexOf("```", afterOpen);
    text = fenceEnd === -1 ? text.slice(afterOpen) : text.slice(afterOpen, fenceEnd);
    text = text.trim();
  }

  // Case 2: prose before the first real tag — trim to the first <section/<div.
  const firstTag = text.search(/<(?:section|div)\b/i);
  if (firstTag > 0) {
    text = text.slice(firstTag);
  }

  // Case 3: anything after the last meaningful closing tag is prose.
  // Closing tags we consider part of the hero payload:
  //   </section>, </div>, </style>, </script>
  // We take the latest of these and trim everything after.
  const closers = ["</section>", "</div>", "</style>", "</script>"];
  const lastCloser = closers.reduce(
    (acc, tag) => Math.max(acc, text.lastIndexOf(tag)),
    -1
  );
  if (lastCloser > -1) {
    const endOfTag = text.indexOf(">", lastCloser) + 1;
    text = text.slice(0, endOfTag);
  }

  // Belt-and-braces: remove any stray ``` that survived.
  text = text.replace(/```/g, "");

  return text.trim();
}

// ---------- Resilient JSON parser ------------------------------------------

export function parseJsonResilient<T>(raw: string): T | null {
  if (!raw || typeof raw !== "string") return null;
  // Strip markdown fences if present.
  let cleaned = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i;
  const m = cleaned.match(fence);
  if (m) cleaned = m[1].trim();
  // Find the first `{` and last `}` — AI sometimes prepends explanation.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = cleaned.slice(first, last + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}

// ---------- Text extraction -------------------------------------------------

function textFromResponse(resp: Anthropic.Message): string {
  let out = "";
  for (const block of resp.content) {
    if (block.type === "text") out += block.text;
  }
  return out;
}

// ---------- Safe defaults for Call 2 ---------------------------------------

const SAFE_GLOBAL_TOKENS: GlobalTokens = {
  bgPrimary: "#0E0A0F",
  bgSecondary: "#1A0F1E",
  bgCard: "rgba(255,255,255,0.02)",
  accent: "#C4607A",
  accentLight: "#E8A0B0",
  gold: "#D4A853",
  textPrimary: "rgba(253,246,238,0.9)",
  textMuted: "rgba(253,246,238,0.5)",
  textSubtle: "rgba(253,246,238,0.3)",
  fontDisplay: "Great Vibes",
  fontHeading: "Cormorant Garamond",
  fontBody: "Jost"
};

function safeThemeFallback(): ThemeJSON {
  return {
    globalTokens: SAFE_GLOBAL_TOKENS,
    styles: {
      body: {
        background: SAFE_GLOBAL_TOKENS.bgPrimary,
        color: SAFE_GLOBAL_TOKENS.textPrimary
      }
    },
    fonts: ["Great Vibes", "Cormorant Garamond:400,700", "Jost:400,500"],
    particles: { effect: "none", colors: [], count: 0, opacity: 0 },
    content: { ...CONTENT_DEFAULTS },
    designSummary: "Safe fallback — Call 2 output could not be parsed.",
    reasoning: {}
  };
}

// Phase B removed `safeHeroFallback`. Call 3 now renders a globalTokens-coherent
// fallback envelope via `buildFallbackEnvelope` whenever extractor or validator
// rejects the AI output — see `runCall3` below.

// ---------- Public API ----------------------------------------------------

export async function runCall2(input: Call2Input): Promise<ThemeJSON> {
  const client = getClient();
  const prompt = buildCall2Prompt(input);
  try {
    const resp = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }]
    });
    const text = textFromResponse(resp);
    const parsed = parseJsonResilient<ThemeJSON>(text);
    if (!parsed) {
      console.warn("[runCall2] JSON parse failed — using safe fallback. Raw preview:", text.slice(0, 400));
      return safeThemeFallback();
    }
    const bundle: ThemeJSON = {
      globalTokens: parsed.globalTokens ?? SAFE_GLOBAL_TOKENS,
      styles: parsed.styles ?? {},
      fonts: Array.isArray(parsed.fonts) ? parsed.fonts : [],
      particles: parsed.particles ?? { effect: "none", colors: [], count: 0, opacity: 0 },
      content: parsed.content ?? {},
      designSummary: parsed.designSummary ?? "",
      reasoning: parsed.reasoning ?? {}
    };
    console.log(
      `[runCall2] parsed OK — selectors=${Object.keys(bundle.styles).length}, content keys=${Object.keys(bundle.content).length}, fonts=${bundle.fonts.length}, summary="${bundle.designSummary.slice(0, 80)}"`
    );
    // Phase B — warn-only validator. Downstream validateAll() fills defaults
    // for any rule failures so the site still renders. Phase C will retry.
    const v = validateCall2Json(bundle);
    if (!v.ok) {
      console.warn(
        `[runCall2] validator failed (${v.failures.length} rule(s)) — using output anyway, defaults will fill gaps:\n  - ${v.failures.join("\n  - ")}`
      );
    }
    return bundle;
  } catch (err) {
    console.error("[runCall2] AI call failed, using safe fallback:", err);
    return safeThemeFallback();
  }
}

export async function runCall3(input: Call3Input): Promise<string> {
  const client = getClient();
  const prompt = buildCall3Prompt(input);

  const renderFallback = (reason: string): string => {
    console.warn(`[runCall3] using fallback hero — ${reason}`);
    const envelope = buildFallbackEnvelope(input.globalTokens);
    return buildHeroFromJson(envelope, { fallback: true });
  };

  try {
    // Phase B: maxTokens bumped 4000 → 6000. JSON-encoded CSS adds ~15%
    // overhead from quote/newline escaping; the previous limit truncated
    // mid-style block, which was a primary driver of the "missing CSS" bug.
    const resp = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }]
    });
    const raw = textFromResponse(resp).trim();
    if (!raw) {
      return renderFallback("empty response from Anthropic");
    }

    let envelope: HeroJsonEnvelope;
    try {
      envelope = extractHeroJson(raw);
    } catch (err) {
      const detail =
        err instanceof HeroExtractionError ? err.message : String(err);
      return renderFallback(`extractor rejected response: ${detail}`);
    }

    const validation = validateHeroJson(envelope);
    if (!validation.ok) {
      return renderFallback(
        `validator rejected envelope (${validation.failures.length} rule(s)):\n  - ${validation.failures.join("\n  - ")}`
      );
    }

    const html = buildHeroFromJson(envelope);
    console.log(
      `[runCall3] hero envelope OK — html=${envelope.html.length} chars, style=${envelope.style.length} chars, script=${envelope.script.length} chars`
    );
    return html;
  } catch (err) {
    console.error("[runCall3] AI call failed:", err);
    return renderFallback("AI call threw");
  }
}

export async function runClassifier(input: ClassifierInput): Promise<AIEditClassification> {
  const client = getClient();
  const prompt = buildClassifierPrompt(input);
  try {
    const resp = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    });
    const text = textFromResponse(resp);
    const parsed = parseJsonResilient<{
      type: EditType;
      confidence: "high" | "low";
      reasoning?: string;
      dataField?: string;
      target?: string;
    }>(text);
    if (!parsed) {
      return { type: "design", confidence: 0, reason: "Parser fallback" };
    }
    const confidenceScore = parsed.confidence === "high" ? 0.9 : 0.4;
    // Low confidence → coerce toward "design" per §12 safety rule.
    const type: EditType =
      parsed.confidence === "low" && parsed.type === "data" ? "design" : parsed.type;
    return {
      type,
      confidence: confidenceScore,
      reason: parsed.reasoning,
      target: parsed.target ?? parsed.dataField
    };
  } catch (err) {
    console.error("[runClassifier] failed, defaulting to 'design':", err);
    return { type: "design", confidence: 0, reason: "Error fallback" };
  }
}
