// Call 3 JSON envelope extraction.
//
// Phase B replaces the previous raw-HTML extractor (extractHeroHtml in
// src/lib/ai/generate.ts) with a JSON envelope. Our code owns the
// <section>/<style>/<script> wrappers; AI owns the content inside each
// field. See doc/hero_html_extraction.md and doc/phase-b-validators.md.
//
// This module:
//   1. Locates the JSON object by first { and last } — discards prose,
//      markdown fences, or any non-JSON noise around it.
//   2. Parses with JSON.parse(). On failure throws HeroExtractionError
//      so the caller (generate.ts) can fall back gracefully.
//   3. Returns a typed HeroJsonEnvelope. Field-level validation is
//      validateHeroJson's job; this module only guarantees JSON shape.

import type { HeroJsonEnvelope } from "@/lib/types";

export class HeroExtractionError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string
  ) {
    super(message);
    this.name = "HeroExtractionError";
  }
}

export function extractHeroJson(raw: string): HeroJsonEnvelope {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new HeroExtractionError(
      "Empty AI response — no content to extract.",
      raw
    );
  }

  // Boundary detection — first { to last }. Discards markdown fences, prose
  // prefix/suffix, anything that isn't JSON shape.
  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) {
    throw new HeroExtractionError(
      "No JSON object found in AI response — response contains no { character. " +
        "Expected JSON envelope { html, style, script }.",
      raw
    );
  }

  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace <= firstBrace) {
    throw new HeroExtractionError(
      "No closing } found — JSON object is not terminated. " +
        "AI response may have been truncated mid-output (token limit).",
      raw
    );
  }

  const candidate = raw.slice(firstBrace, lastBrace + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new HeroExtractionError(
      `Extracted content is not valid JSON: ${detail}. ` +
        "Check that CSS and JavaScript inside the fields are correctly escaped " +
        "(double quotes as \\\", newlines as \\n).",
      raw
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HeroExtractionError(
      "Parsed JSON is not an object — expected { html, style, script }.",
      raw
    );
  }

  const obj = parsed as Record<string, unknown>;
  return {
    html: typeof obj.html === "string" ? obj.html : "",
    style: typeof obj.style === "string" ? obj.style : "",
    script: typeof obj.script === "string" ? obj.script : ""
  };
}
