// Call 3 envelope validator — 11 deterministic rules.
//
// See doc/phase-b-validators.md §"Validator rules" for the contract and the
// reasoning behind each rule. On any failure the caller (generate.ts) swaps
// in the fallback envelope; this module only diagnoses.
//
// Rules cover three failure classes:
//   - Shape: fields present and the right type (rule 1).
//   - Substance: html/style aren't trivially short (rules 2, 5).
//   - Safety/contract: no nested wrappers (3, 4, 10), no required-placeholder
//     omissions (7, 8), no smuggled-in external resources (6, 9), no XSS via
//     placeholder substitution in JS context (11).

import type { HeroJsonEnvelope } from "@/lib/types";

export interface ValidateHeroJsonResult {
  ok: boolean;
  failures: string[];
}

const MIN_HTML_LEN = 50;
const MIN_STYLE_LEN = 100;

const REQUIRED_PLACEHOLDERS = ["{{PERSON1_NAME}}", "{{PERSON2_NAME}}"] as const;
const REQUIRED_HREF = "#rsvp";

const PLACEHOLDER_PATTERN = /\{\{[A-Z0-9_]+\}\}/;

export function validateHeroJson(envelope: HeroJsonEnvelope): ValidateHeroJsonResult {
  const failures: string[] = [];
  const { html, style, script } = envelope;

  // Rule 1 — all 3 fields present and string.
  if (typeof html !== "string" || typeof style !== "string" || typeof script !== "string") {
    failures.push(
      "Rule 1: envelope must have html/style/script as strings"
    );
    // No point checking the rest if shape is wrong.
    return { ok: false, failures };
  }

  // Rule 2 — html length ≥ 50.
  if (html.length < MIN_HTML_LEN) {
    failures.push(
      `Rule 2: html field is too short (${html.length} chars, min ${MIN_HTML_LEN})`
    );
  }

  // Rule 3 — html contains no <style> tag.
  if (/<style[\s>]/i.test(html)) {
    failures.push(
      "Rule 3: html field must not contain <style> tags (CSS belongs in style field)"
    );
  }

  // Rule 4 — html contains no <script> tag.
  if (/<script[\s>]/i.test(html)) {
    failures.push(
      "Rule 4: html field must not contain <script> tags (JS belongs in script field)"
    );
  }

  // Rule 5 — style length ≥ 100.
  if (style.length < MIN_STYLE_LEN) {
    failures.push(
      `Rule 5: style field is too short (${style.length} chars, min ${MIN_STYLE_LEN}) — likely unstyled hero`
    );
  }

  // Rule 6 — style contains no @import.
  if (/@import\b/i.test(style)) {
    failures.push(
      "Rule 6: style field must not contain @import — fonts are managed by the renderer"
    );
  }

  // Rule 7 — html contains required placeholders.
  for (const placeholder of REQUIRED_PLACEHOLDERS) {
    if (!html.includes(placeholder)) {
      failures.push(`Rule 7: html field is missing required placeholder ${placeholder}`);
    }
  }

  // Rule 8 — html contains an href to #rsvp.
  if (!html.includes(REQUIRED_HREF)) {
    failures.push(
      `Rule 8: html field must contain a CTA link to ${REQUIRED_HREF}`
    );
  }

  // Rule 9 — html contains no external resource references.
  if (/<script\s[^>]*\bsrc\s*=/i.test(html)) {
    failures.push(
      "Rule 9: html field must not load external scripts (<script src=...>)"
    );
  }
  if (/<link\s[^>]*\brel\s*=\s*["']?stylesheet/i.test(html)) {
    failures.push(
      "Rule 9: html field must not link external stylesheets (<link rel=stylesheet>)"
    );
  }

  // Rule 10 — html contains no <section> tags (would break the wrapper).
  if (/<\/?section[\s>]/i.test(html)) {
    failures.push(
      "Rule 10: html field must not contain <section> or </section> tags — the assembler owns the section wrapper"
    );
  }

  // Rule 11 — script contains no {{PLACEHOLDER}} tokens (XSS via JS-context substitution).
  if (PLACEHOLDER_PATTERN.test(script)) {
    failures.push(
      "Rule 11: script field must not reference {{PLACEHOLDER}} tokens — substituting user content into a JS context is an XSS vector"
    );
  }

  return { ok: failures.length === 0, failures };
}
