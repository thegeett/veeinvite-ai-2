// Phase B — Call 2 deterministic validator. 6 rules, one passing fixture +
// one failing fixture per rule.

import { describe, expect, it } from "vitest";
import { validateCall2Json } from "@/lib/ai/validateCall2Json";
import type { GlobalTokens, ThemeJSON } from "@/lib/types";

const FULL_TOKENS: GlobalTokens = {
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

// 30 distinct selectors, including all REQUIRED ones.
function buildStyles(): Record<string, Record<string, string>> {
  const required = [
    "body", "nav", ".story", ".story-heading",
    ".events", ".events-heading",
    ".rsvp", ".rsvp-heading", ".rsvp-submit", "footer"
  ];
  const filler = [
    ".nav-monogram", ".nav-link", ".story-eyebrow", ".story-script",
    ".story-body", ".story-quote", ".events-eyebrow", ".events-grid",
    ".event-card", ".event-name", ".event-detail", ".rsvp-eyebrow",
    ".rsvp-sub", ".rsvp-form", ".form-field input", ".rsvp-submit:hover",
    ".gallery", ".gallery-heading", ".gallery-item", ".faq",
    ".faq-question", ".faq-answer", ".footer-names", ".footer-info",
    ".footer-tagline"
  ];
  const map: Record<string, Record<string, string>> = {};
  for (const s of [...required, ...filler]) {
    map[s] = { color: "#FDF6EE", background: "#0E0A0F" };
  }
  return map;
}

function buildContent(count = 32): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    out[`KEY_${i}`] = `value ${i}`;
  }
  return out;
}

function buildValidTheme(): ThemeJSON {
  return {
    globalTokens: FULL_TOKENS,
    styles: buildStyles(),
    fonts: ["Great Vibes", "Cormorant Garamond:400,700", "Jost:400,500"],
    particles: { effect: "none", colors: [], count: 0, opacity: 0 },
    content: buildContent(),
    designSummary: "A warm, romantic wedding site grounded in deep aubergine with rose-gold accents.",
    reasoning: {}
  };
}

describe("validateCall2Json — 6 rules", () => {
  it("accepts a fully valid Call 2 bundle", () => {
    const r = validateCall2Json(buildValidTheme());
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("Rule 1: rejects when globalTokens is missing a key", () => {
    const theme = buildValidTheme();
    delete (theme.globalTokens as Partial<GlobalTokens>).accent;
    const r = validateCall2Json(theme);
    expect(r.failures.join("\n")).toMatch(/Rule 1.*accent/);
  });

  it("Rule 2: rejects when styles has fewer than 25 selectors", () => {
    const theme = buildValidTheme();
    theme.styles = { body: { color: "#fff" }, nav: {} };
    const r = validateCall2Json(theme);
    expect(r.failures.join("\n")).toMatch(/Rule 2/);
  });

  it("Rule 3: rejects when a required selector is missing", () => {
    const theme = buildValidTheme();
    delete (theme.styles as Record<string, unknown>)[".rsvp-submit"];
    const r = validateCall2Json(theme);
    expect(r.failures.join("\n")).toMatch(/Rule 3.*rsvp-submit/);
  });

  it("Rule 4: rejects when fonts contains an unapproved family", () => {
    const theme = buildValidTheme();
    theme.fonts = ["Comic Sans MS"];
    const r = validateCall2Json(theme);
    expect(r.failures.join("\n")).toMatch(/Rule 4.*Comic Sans/);
  });

  it("Rule 4: rejects when fonts is empty", () => {
    const theme = buildValidTheme();
    theme.fonts = [];
    const r = validateCall2Json(theme);
    expect(r.failures.join("\n")).toMatch(/Rule 4/);
  });

  it("Rule 5: rejects when content has fewer than 30 non-empty values", () => {
    const theme = buildValidTheme();
    theme.content = buildContent(10);
    const r = validateCall2Json(theme);
    expect(r.failures.join("\n")).toMatch(/Rule 5/);
  });

  it("Rule 6: rejects when designSummary is too short", () => {
    const theme = buildValidTheme();
    theme.designSummary = "short";
    const r = validateCall2Json(theme);
    expect(r.failures.join("\n")).toMatch(/Rule 6/);
  });

  it("rejects entirely non-object input", () => {
    const r = validateCall2Json("not an object");
    expect(r.ok).toBe(false);
  });
});
