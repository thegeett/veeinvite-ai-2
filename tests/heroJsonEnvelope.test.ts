// Phase B test suite — JSON envelope extractor + validator + assembler + fallback.
// One spec file groups all four units because they form a single Call 3 pipeline.

import { describe, expect, it } from "vitest";
import {
  extractHeroJson,
  HeroExtractionError
} from "@/lib/renderer/extractHeroJson";
import { validateHeroJson } from "@/lib/renderer/validateHeroJson";
import { buildHeroFromJson } from "@/lib/renderer/buildHeroFromJson";
import { buildFallbackEnvelope } from "@/lib/renderer/fallbackHero";
import type { GlobalTokens, HeroJsonEnvelope } from "@/lib/types";

const VALID_HTML = `
<div class="hero__inner">
  <h1>{{PERSON1_NAME}} & {{PERSON2_NAME}}</h1>
  <p>{{WEDDING_DATE_DISPLAY}}</p>
  <a href="#rsvp" class="hero__cta">{{CTA_LABEL}}</a>
</div>
`.trim();

const VALID_STYLE = `
.hero { padding: 80px 24px; background: #0E0A0F; color: #FDF6EE; text-align: center; }
.hero__inner { max-width: 720px; margin: 0 auto; }
.hero h1 { font-family: 'Great Vibes', cursive; font-size: 4rem; }
.hero a { color: #C4607A; text-decoration: none; padding: 12px 32px; }
`.trim();

const VALID_ENVELOPE: HeroJsonEnvelope = {
  html: VALID_HTML,
  style: VALID_STYLE,
  script: ""
};

const SAMPLE_TOKENS: GlobalTokens = {
  bgPrimary: "#0E0A0F",
  bgSecondary: "#1A0F1E",
  bgCard: "rgba(255,255,255,0.02)",
  accent: "#C4607A",
  accentLight: "#E8A0B0",
  gold: "#D4A853",
  textPrimary: "#FDF6EE",
  textMuted: "rgba(253,246,238,0.5)",
  textSubtle: "rgba(253,246,238,0.3)",
  fontDisplay: "Great Vibes",
  fontHeading: "Cormorant Garamond",
  fontBody: "Jost"
};

// PALETTE-03: buildFallbackEnvelope now takes the 4 expressive tokens. The
// existing SAMPLE_TOKENS is kept for any other test that still wants the
// full 12-field GlobalTokens shape.
const SAMPLE_PALETTE = {
  bgPrimary: SAMPLE_TOKENS.bgPrimary,
  accent: SAMPLE_TOKENS.accent,
  gold: SAMPLE_TOKENS.gold,
  fontDisplay: SAMPLE_TOKENS.fontDisplay
};

// -----------------------------------------------------------------------------
// extractHeroJson
// -----------------------------------------------------------------------------

describe("extractHeroJson — JSON envelope extraction", () => {
  it("parses a clean JSON envelope", () => {
    const raw = JSON.stringify(VALID_ENVELOPE);
    const out = extractHeroJson(raw);
    expect(out.html).toBe(VALID_HTML);
    expect(out.style).toBe(VALID_STYLE);
    expect(out.script).toBe("");
  });

  it("strips markdown fences and prose around the JSON", () => {
    const raw = "Sure! Here is the hero:\n```json\n" + JSON.stringify(VALID_ENVELOPE) + "\n```\nLet me know if you need changes.";
    const out = extractHeroJson(raw);
    expect(out.html).toBe(VALID_HTML);
  });

  it("throws HeroExtractionError on empty input", () => {
    expect(() => extractHeroJson("")).toThrow(HeroExtractionError);
    expect(() => extractHeroJson("   ")).toThrow(HeroExtractionError);
  });

  it("throws HeroExtractionError when no { is present", () => {
    expect(() => extractHeroJson("just prose, no json here at all")).toThrow(HeroExtractionError);
  });

  it("throws HeroExtractionError when no closing } is present (truncation)", () => {
    expect(() => extractHeroJson('{"html": "abc"')).toThrow(HeroExtractionError);
  });

  it("throws HeroExtractionError on malformed JSON inside the braces", () => {
    expect(() => extractHeroJson('{"html": "abc", style: bad}')).toThrow(HeroExtractionError);
  });

  it("strips array brackets surrounding a JSON object — extractor grabs the inner object", () => {
    // The boundary detector takes the first { to the last }, which is by design.
    // An array-wrapped object collapses to just the object.
    const out = extractHeroJson('[{"html": "x"}]');
    expect(out.html).toBe("x");
  });

  it("coerces missing / non-string fields to empty strings", () => {
    const out = extractHeroJson('{"html": "abc", "style": 123}');
    expect(out.html).toBe("abc");
    expect(out.style).toBe("");
    expect(out.script).toBe("");
  });
});

// -----------------------------------------------------------------------------
// validateHeroJson — 11 rules
// -----------------------------------------------------------------------------

describe("validateHeroJson — 11 rules", () => {
  it("accepts a fully valid envelope", () => {
    const r = validateHeroJson(VALID_ENVELOPE);
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("Rule 1: rejects when fields are not strings", () => {
    const r = validateHeroJson({ html: 123 as unknown as string, style: "", script: "" });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/Rule 1/);
  });

  it("Rule 2: rejects html shorter than 50 chars", () => {
    const r = validateHeroJson({ ...VALID_ENVELOPE, html: "<div>tiny</div>" });
    expect(r.ok).toBe(false);
    expect(r.failures.join("\n")).toMatch(/Rule 2/);
  });

  it("Rule 3: rejects html with nested <style> tag", () => {
    const html = VALID_HTML + '<style>.x{color:red}</style>';
    const r = validateHeroJson({ ...VALID_ENVELOPE, html });
    expect(r.failures.join("\n")).toMatch(/Rule 3/);
  });

  it("Rule 4: rejects html with nested <script> tag", () => {
    const html = VALID_HTML + '<script>alert(1)</script>';
    const r = validateHeroJson({ ...VALID_ENVELOPE, html });
    expect(r.failures.join("\n")).toMatch(/Rule 4/);
  });

  it("Rule 5: rejects style shorter than 100 chars", () => {
    const r = validateHeroJson({ ...VALID_ENVELOPE, style: ".hero{}" });
    expect(r.failures.join("\n")).toMatch(/Rule 5/);
  });

  it("Rule 6: rejects style containing @import", () => {
    const style = VALID_STYLE + "\n@import url('https://fonts.googleapis.com');";
    const r = validateHeroJson({ ...VALID_ENVELOPE, style });
    expect(r.failures.join("\n")).toMatch(/Rule 6/);
  });

  it("Rule 7: rejects html missing required name placeholders", () => {
    const html = VALID_HTML.replace("{{PERSON2_NAME}}", "Alice");
    const r = validateHeroJson({ ...VALID_ENVELOPE, html });
    expect(r.failures.join("\n")).toMatch(/Rule 7.*PERSON2_NAME/);
  });

  it("Rule 8: rejects html missing #rsvp link", () => {
    const html = VALID_HTML.replace('href="#rsvp"', 'href="#somewhere"');
    const r = validateHeroJson({ ...VALID_ENVELOPE, html });
    expect(r.failures.join("\n")).toMatch(/Rule 8/);
  });

  it("Rule 9: rejects html with external <script src>", () => {
    const html = VALID_HTML + '<script src="https://evil.example/x.js"></script>';
    const r = validateHeroJson({ ...VALID_ENVELOPE, html });
    // Both Rule 4 (nested script) and Rule 9 (external src) trigger; Rule 9 must be one of them.
    expect(r.failures.join("\n")).toMatch(/Rule 9/);
  });

  it("Rule 9: rejects html with external <link rel=stylesheet>", () => {
    const html = VALID_HTML + '<link rel="stylesheet" href="https://evil.example/x.css">';
    const r = validateHeroJson({ ...VALID_ENVELOPE, html });
    expect(r.failures.join("\n")).toMatch(/Rule 9/);
  });

  it("Rule 10: rejects html containing <section> or </section>", () => {
    const r1 = validateHeroJson({ ...VALID_ENVELOPE, html: VALID_HTML + "<section></section>" });
    expect(r1.failures.join("\n")).toMatch(/Rule 10/);
    const r2 = validateHeroJson({ ...VALID_ENVELOPE, html: '<section class="hero">' + VALID_HTML });
    expect(r2.failures.join("\n")).toMatch(/Rule 10/);
  });

  it("Rule 11: rejects script referencing {{PLACEHOLDER}} tokens", () => {
    const r = validateHeroJson({
      ...VALID_ENVELOPE,
      script: 'document.title = "{{PERSON1_NAME}}";'
    });
    expect(r.failures.join("\n")).toMatch(/Rule 11/);
  });

  it("accepts a script with no placeholders", () => {
    const r = validateHeroJson({
      ...VALID_ENVELOPE,
      script: "document.querySelector('.hero').classList.add('ready');"
    });
    expect(r.ok).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// buildHeroFromJson — assembler structure
// -----------------------------------------------------------------------------

describe("buildHeroFromJson — assembler", () => {
  it("wraps html in <section class=\"hero\"> and emits <style>", () => {
    const out = buildHeroFromJson(VALID_ENVELOPE);
    expect(out.startsWith('<section class="hero">')).toBe(true);
    expect(out.endsWith("</section>")).toBe(true);
    expect(out).toContain("<style>");
    expect(out).toContain("</style>");
    expect(out).toContain(VALID_HTML);
  });

  it("omits <script> when script is empty", () => {
    const out = buildHeroFromJson(VALID_ENVELOPE);
    expect(out).not.toContain("<script>");
  });

  it("emits <script> when script is non-empty", () => {
    const out = buildHeroFromJson({
      ...VALID_ENVELOPE,
      script: "console.log('hi');"
    });
    expect(out).toContain("<script>console.log('hi');</script>");
  });

  it("marks the section with data-fallback when fallback option is true", () => {
    const out = buildHeroFromJson(VALID_ENVELOPE, { fallback: true });
    expect(out.startsWith('<section class="hero" data-fallback="true">')).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// buildFallbackEnvelope — must itself pass the validator
// -----------------------------------------------------------------------------

describe("buildFallbackEnvelope — globalTokens-coherent fallback", () => {
  it("passes validateHeroJson", () => {
    const env = buildFallbackEnvelope(SAMPLE_PALETTE);
    const r = validateHeroJson(env);
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("incorporates the couple's accent and bgPrimary into the style", () => {
    const env = buildFallbackEnvelope(SAMPLE_PALETTE);
    expect(env.style).toContain(SAMPLE_TOKENS.accent);
    expect(env.style).toContain(SAMPLE_TOKENS.bgPrimary);
  });

  it("contains the required placeholders for downstream substitution", () => {
    const env = buildFallbackEnvelope(SAMPLE_PALETTE);
    expect(env.html).toContain("{{PERSON1_NAME}}");
    expect(env.html).toContain("{{PERSON2_NAME}}");
    expect(env.html).toContain("{{WEDDING_DATE_DISPLAY}}");
    expect(env.html).toContain("{{VENUE_NAME}}");
    expect(env.html).toContain("{{CTA_LABEL}}");
  });

  it("uses min-height 60vh per design spec", () => {
    const env = buildFallbackEnvelope(SAMPLE_PALETTE);
    expect(env.style).toMatch(/min-height:\s*60vh/);
  });
});
