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
  ThemeJSON
} from "@/lib/types";
import { CONTENT_DEFAULTS } from "@/lib/types";
import {
  buildCall2Prompt,
  buildCall3Prompt,
  buildClassifierPrompt
} from "./prompt";

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

function safeHeroFallback(): string {
  return `<section class="hero">
  <div class="hero-inner">
    <h1 class="hero-names">{{PERSON1_NAME}} <span>&amp;</span> {{PERSON2_NAME}}</h1>
    <p class="hero-tagline">{{TAGLINE}}</p>
    <p class="hero-date">{{WEDDING_DATE_DISPLAY}} · {{VENUE_NAME}}, {{VENUE_CITY}}</p>
    <a class="hero-cta" href="#rsvp">{{CTA_LABEL}}</a>
  </div>
  <style>
    .hero { padding: 6rem 1.5rem; text-align: center; }
    .hero-names { font-family: 'Great Vibes', cursive; }
  </style>
</section>`;
}

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
    if (!parsed) return safeThemeFallback();
    // Ensure the shape has required keys — fall back per key if missing.
    return {
      globalTokens: parsed.globalTokens ?? SAFE_GLOBAL_TOKENS,
      styles: parsed.styles ?? {},
      fonts: Array.isArray(parsed.fonts) ? parsed.fonts : [],
      particles: parsed.particles ?? { effect: "none", colors: [], count: 0, opacity: 0 },
      content: parsed.content ?? {},
      designSummary: parsed.designSummary ?? "",
      reasoning: parsed.reasoning ?? {}
    };
  } catch (err) {
    console.error("[runCall2] AI call failed, using safe fallback:", err);
    return safeThemeFallback();
  }
}

export async function runCall3(input: Call3Input): Promise<string> {
  const client = getClient();
  const prompt = buildCall3Prompt(input);
  try {
    const resp = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }]
    });
    const text = textFromResponse(resp).trim();
    if (!text) return safeHeroFallback();
    // Strip optional markdown fences.
    const fence = /^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i;
    const m = text.match(fence);
    const body = m ? m[1].trim() : text;
    // Basic sanity check — must start with a tag.
    if (!body.includes("<section") && !body.includes("<div")) return safeHeroFallback();
    return body;
  } catch (err) {
    console.error("[runCall3] AI call failed, using safe fallback:", err);
    return safeHeroFallback();
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
