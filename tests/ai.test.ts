import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  __setClientForTesting,
  extractHeroHtml,
  parseJsonResilient,
  runCall2,
  runCall3,
  runClassifier
} from "@/lib/ai/generate";
import { buildCall2Prompt, buildCall3Prompt, buildClassifierPrompt, buildEditPrompt } from "@/lib/ai/prompt";
import { detectDataField, keywordFastPath } from "@/lib/ai/classifier";
import { buildCulturalProfile } from "@/lib/cultural/library";
import type { Call2Input, Call3Input } from "@/lib/types";

// ---------- parseJsonResilient --------------------------------------------

describe("parseJsonResilient", () => {
  it("parses plain JSON", () => {
    expect(parseJsonResilient<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips markdown fences", () => {
    const raw = "```json\n{ \"a\": 2 }\n```";
    expect(parseJsonResilient<{ a: number }>(raw)).toEqual({ a: 2 });
  });

  it("extracts JSON from prose", () => {
    const raw = "Here is the classification:\n{ \"type\": \"design\" }\nGood luck!";
    expect(parseJsonResilient<{ type: string }>(raw)).toEqual({ type: "design" });
  });

  it("returns null for garbage", () => {
    expect(parseJsonResilient("not json at all")).toBeNull();
    expect(parseJsonResilient("")).toBeNull();
  });
});

// ---------- extractHeroHtml -----------------------------------------------

describe("extractHeroHtml — robust markdown-fence + prose stripping", () => {
  it("returns clean HTML unchanged", () => {
    const raw = "<section class=\"hero\"><h1>Hi</h1></section>";
    expect(extractHeroHtml(raw)).toBe(raw);
  });

  it("strips ```html fence at start and ``` at end", () => {
    const raw = "```html\n<section class=\"hero\"><h1>Hi</h1></section>\n```";
    expect(extractHeroHtml(raw)).toBe('<section class="hero"><h1>Hi</h1></section>');
  });

  it("strips ``` fence (no language tag)", () => {
    const raw = "```\n<section class=\"hero\"></section>\n```";
    expect(extractHeroHtml(raw)).toBe('<section class="hero"></section>');
  });

  it("strips leading prose before first <section", () => {
    const raw = "Here is the hero markup:\n<section class=\"hero\">X</section>";
    expect(extractHeroHtml(raw)).toBe('<section class="hero">X</section>');
  });

  it("strips trailing prose after last </section>", () => {
    const raw = "<section class=\"hero\">X</section>\n\nHope this helps!";
    expect(extractHeroHtml(raw)).toBe('<section class="hero">X</section>');
  });

  it("handles fence + prose + extra newlines together", () => {
    const raw = "Sure thing!\n\n```html\n<section class=\"hero\">X</section>\n```\n\nDone.";
    expect(extractHeroHtml(raw)).toBe('<section class="hero">X</section>');
  });

  it("removes stray ``` survivors (unclosed fence)", () => {
    const raw = "```html\n<section class=\"hero\">X</section>";
    const out = extractHeroHtml(raw);
    expect(out).not.toContain("```");
    expect(out).toContain("<section");
  });

  it("never lets ```html leak into output", () => {
    // The bug the user reported: ```html visible on the page.
    const raw = "```html\n<section class=\"hero\">\n  <h1>Names</h1>\n</section>\n```";
    const out = extractHeroHtml(raw);
    expect(out).not.toMatch(/```/);
    expect(out).not.toMatch(/\bhtml\b[^>]/);
  });
});

// ---------- Prompt builders -----------------------------------------------

describe("prompt builders", () => {
  const baseCouple = {
    person1_name: "Meera",
    person2_name: "Arjun",
    wedding_date: "14 November 2025",
    venue_name: "Rambagh Palace",
    venue_city: "Jaipur",
    style: "South Asian Grand" as const,
    vibe: "grand, festive, ornate",
    story: null,
    cultural_context: "hindu_indian"
  };

  it("Call 2 prompt embeds §5 coherence instruction verbatim", () => {
    const prompt = buildCall2Prompt({
      skeletonHtml: "<html></html>",
      layoutId: "layout-3",
      couple: baseCouple,
      culturalProfile: buildCulturalProfile("hindu_indian", "tamil", [], [], {}),
      tags: ["grand", "ornate"]
    });
    expect(prompt).toContain("You are designing the complete visual identity");
    expect(prompt).toContain("globalTokens");
    expect(prompt).toContain("FORBIDDEN CSS PROPERTIES");
    expect(prompt).toContain("APPROVED FONTS");
    expect(prompt).toContain("Great Vibes");
    // cultural block
    expect(prompt).toContain("COPY GUARDRAILS");
    expect(prompt).toContain("Never use Sangeet, Pheras");
  });

  it("Call 3 prompt substitutes globalTokens values and culture block", () => {
    const input: Call3Input = {
      globalTokens: {
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
      },
      couple: baseCouple,
      culturalProfile: buildCulturalProfile("muslim", "arab_muslim", ["muslim_bismillah"], [], {
        bismillah_text: "Bismillah-ir-Rahman-ir-Rahim"
      })
    };
    const prompt = buildCall3Prompt(input);
    expect(prompt).toContain("USE THESE EXACT VALUES");
    expect(prompt).toContain("#0E0A0F");
    expect(prompt).toContain("Great Vibes");
    expect(prompt).toContain("{{PERSON1_NAME_BILINGUAL}}");
    // muslim guardrails in the cultural block
    expect(prompt).toMatch(/No alcohol references/i);
  });

  it("Classifier prompt lists all six edit types and safety rules", () => {
    const prompt = buildClassifierPrompt({ instruction: "make it more romantic" });
    expect(prompt).toContain('"data"');
    expect(prompt).toContain('"content"');
    expect(prompt).toContain('"hero"');
    expect(prompt).toContain('"design"');
    expect(prompt).toContain('"global"');
    expect(prompt).toContain('"new_section"');
    expect(prompt).toContain("default to \"design\"");
  });

  it("Edit prompt routes design/hero/content/data/new_section", () => {
    const input = {
      instruction: "tweak",
      designSummary: "Midnight garden",
      couple: baseCouple,
      culturalProfile: null,
      tags: [],
      themeJson: {
        globalTokens: {
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
        },
        styles: {},
        fonts: [],
        particles: { effect: "none" as const, colors: [], count: 0, opacity: 0 },
        content: {},
        designSummary: ""
      }
    };
    const hero = buildEditPrompt(input, { type: "hero", confidence: 0.9 });
    expect(hero).toContain("hero");
    const design = buildEditPrompt(input, { type: "design", confidence: 0.9 });
    expect(design).toContain("Preserve everything");
    const data = buildEditPrompt(input, { type: "data", confidence: 0.9 });
    expect(data).toContain("No AI call required");
    const newSec = buildEditPrompt(input, { type: "new_section", confidence: 0.9 });
    expect(newSec).toContain("new <section");
  });
});

// ---------- Classifier fast path ------------------------------------------

describe("classifier fast path + data-field detector", () => {
  it("detects data field for 'change our names to X'", () => {
    expect(detectDataField("change our names to Meera and Arjun")).toBe("person1_name");
  });

  it("detects venue", () => {
    expect(detectDataField("update the venue to Rambagh Palace")).toBe("venue_name");
  });

  it("returns undefined for design talk", () => {
    expect(detectDataField("make the story quote more dramatic")).toBeUndefined();
  });

  it("fast path: 'start fresh' → global", () => {
    expect(keywordFastPath({ instruction: "start fresh" })?.type).toBe("global");
  });

  it("fast path: 'add a section about our dog' → new_section", () => {
    expect(keywordFastPath({ instruction: "add a section about our dog" })?.type).toBe("new_section");
  });

  it("fast path returns undefined for ambiguous text", () => {
    expect(keywordFastPath({ instruction: "make it more romantic" })).toBeUndefined();
  });
});

// ---------- runCall2 / runCall3 / runClassifier against stubbed SDK -------

interface StubMessage {
  content: Array<{ type: "text"; text: string }>;
}

function stubClient(reply: string): { messages: { create: () => Promise<StubMessage> } } {
  return {
    messages: {
      create: async () => ({ content: [{ type: "text", text: reply }] })
    }
  };
}

describe("AI runners with stubbed client", () => {
  afterEach(() => __setClientForTesting(null));

  it("runCall2 parses well-formed JSON", async () => {
    const theme = {
      globalTokens: {
        bgPrimary: "#000", bgSecondary: "#111", bgCard: "rgba(0,0,0,0.1)",
        accent: "#f00", accentLight: "#faa", gold: "#d4a",
        textPrimary: "#fff", textMuted: "#aaa", textSubtle: "#888",
        fontDisplay: "Great Vibes", fontHeading: "Cormorant Garamond", fontBody: "Jost"
      },
      styles: { body: { background: "#000" } },
      fonts: ["Great Vibes"],
      particles: { effect: "none", colors: [], count: 0, opacity: 0 },
      content: { TAGLINE: "Forever" },
      designSummary: "Dark and dramatic",
      reasoning: {}
    };
    __setClientForTesting(stubClient(JSON.stringify(theme)) as never);
    const result = await runCall2({
      skeletonHtml: "<html></html>",
      layoutId: "layout-1",
      couple: {
        person1_name: "A", person2_name: "B", wedding_date: "1 Jan", venue_name: "X",
        venue_city: "Y", style: null, vibe: null, story: null, cultural_context: null
      },
      culturalProfile: null,
      tags: []
    });
    expect(result.globalTokens.accent).toBe("#f00");
    expect(result.content.TAGLINE).toBe("Forever");
  });

  it("runCall2 falls back on unparseable output", async () => {
    __setClientForTesting(stubClient("not json at all") as never);
    const result = await runCall2({
      skeletonHtml: "<html></html>",
      layoutId: "layout-1",
      couple: {
        person1_name: "A", person2_name: "B", wedding_date: "1", venue_name: "X",
        venue_city: "Y", style: null, vibe: null, story: null, cultural_context: null
      },
      culturalProfile: null,
      tags: []
    });
    expect(result.designSummary).toMatch(/fallback/i);
  });

  it("runCall3 extracts hero HTML from fenced output", async () => {
    const fenced = "```html\n<section class=\"hero\">hero body</section>\n```";
    __setClientForTesting(stubClient(fenced) as never);
    const result = await runCall3({
      globalTokens: {
        bgPrimary: "#000", bgSecondary: "#111", bgCard: "rgba(0,0,0,0.1)",
        accent: "#f00", accentLight: "#faa", gold: "#d4a",
        textPrimary: "#fff", textMuted: "#aaa", textSubtle: "#888",
        fontDisplay: "Great Vibes", fontHeading: "Cormorant Garamond", fontBody: "Jost"
      },
      couple: {
        person1_name: "A", person2_name: "B", wedding_date: "1", venue_name: "X",
        venue_city: "Y", style: null, vibe: null, story: null
      },
      culturalProfile: null
    });
    expect(result).toContain("<section class=\"hero\"");
  });

  it("runClassifier maps instructions to types", async () => {
    const cases: Array<[string, string]> = [
      [
        '{"type": "design", "confidence": "high", "reasoning": "color change"}',
        "design"
      ],
      [
        '{"type": "data", "confidence": "high", "reasoning": "names change", "dataField": "person1_name"}',
        "data"
      ],
      [
        '{"type": "new_section", "confidence": "high", "reasoning": "new section for pet"}',
        "new_section"
      ]
    ];
    for (const [reply, expected] of cases) {
      __setClientForTesting(stubClient(reply) as never);
      const res = await runClassifier({ instruction: "anything" });
      expect(res.type).toBe(expected);
    }
  });

  it("runClassifier coerces low-confidence 'data' to 'design' (safer)", async () => {
    __setClientForTesting(
      stubClient('{"type": "data", "confidence": "low", "reasoning": "unsure"}') as never
    );
    const res = await runClassifier({ instruction: "something" });
    expect(res.type).toBe("design");
  });
});
