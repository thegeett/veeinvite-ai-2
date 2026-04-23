import { describe, expect, it } from "vitest";
import {
  containsDangerousPattern,
  validateAll,
  validateContent,
  validateDangerousPatterns,
  validateFonts,
  validateParticles,
  validateStyles
} from "@/lib/validator";
import { CONTENT_DEFAULTS, FORBIDDEN_CSS_PROPERTIES } from "@/lib/types";

describe("validator — never throws", () => {
  const bogusInputs: unknown[] = [
    null,
    undefined,
    0,
    "not an object",
    [],
    { styles: "nope" },
    { content: [1, 2, 3] },
    { fonts: { 0: "Inter" } },
    { particles: "sparkles everywhere" },
    {
      styles: {
        body: { display: "flex", color: "rgba(0,0,0,0.8)" },
        ".injected": { background: "url(javascript:alert(1))" }
      }
    }
  ];

  it("never throws for arbitrary inputs", () => {
    for (const input of bogusInputs) {
      expect(() => validateAll(input)).not.toThrow();
    }
  });

  it("fuzz: random object shapes never throw", () => {
    const rand = (depth: number): unknown => {
      if (depth > 4) return Math.random() > 0.5 ? "str" : 1;
      const roll = Math.random();
      if (roll < 0.25) return ["a", rand(depth + 1)];
      if (roll < 0.5) return { [`key_${depth}`]: rand(depth + 1), n: Math.random() };
      if (roll < 0.75) return null;
      return `value_${depth}`;
    };
    for (let i = 0; i < 25; i++) {
      expect(() => validateAll(rand(0))).not.toThrow();
    }
  });
});

describe("validateStyles", () => {
  it("strips every forbidden CSS property", () => {
    const input: Record<string, Record<string, string>> = { body: {} };
    for (const prop of FORBIDDEN_CSS_PROPERTIES) {
      input.body[prop] = "whatever";
    }
    input.body.color = "rgb(10,10,10)";
    const { valid, warnings } = validateStyles(input);
    expect(valid.body).toEqual({ color: "rgb(10,10,10)" });
    expect(warnings.length).toBeGreaterThanOrEqual(FORBIDDEN_CSS_PROPERTIES.length);
  });

  it("preserves safe properties", () => {
    const { valid } = validateStyles({
      ".hero-names": { color: "#C4607A", "font-family": "'Great Vibes', cursive" }
    });
    expect(valid[".hero-names"]).toEqual({
      color: "#C4607A",
      "font-family": "'Great Vibes', cursive"
    });
  });

  it("rejects dangerous CSS values", () => {
    const { valid, errors } = validateStyles({
      ".x": {
        background: "url(javascript:alert(1))",
        color: "#000"
      }
    });
    expect(valid[".x"]).toEqual({ color: "#000" });
    expect(errors[0]).toMatch(/dangerous pattern/i);
  });

  it("drops non-object selector payloads with a warning", () => {
    const { valid, warnings } = validateStyles({ body: "not-an-object" });
    expect(valid).toEqual({});
    expect(warnings[0]).toMatch(/was not an object/);
  });
});

describe("validateFonts", () => {
  it("drops non-approved fonts", () => {
    expect(validateFonts(["Comic Sans", "Inter:400"])).toEqual(["Inter:400"]);
  });

  it("keeps approved fonts with weights", () => {
    expect(validateFonts(["Great Vibes", "Cormorant Garamond:400,700"])).toEqual([
      "Great Vibes",
      "Cormorant Garamond:400,700"
    ]);
  });

  it("deduplicates and ignores non-strings", () => {
    expect(validateFonts(["Inter", "Inter", 42, null, "Inter"])).toEqual(["Inter"]);
  });

  it("returns [] for non-array input", () => {
    expect(validateFonts("Inter")).toEqual([]);
    expect(validateFonts(undefined)).toEqual([]);
  });
});

describe("validateParticles", () => {
  it("clamps count to 0-30", () => {
    expect(validateParticles({ effect: "petals", count: 50 }).count).toBe(30);
    expect(validateParticles({ effect: "petals", count: -10 }).count).toBe(0);
  });

  it("clamps opacity to 0-0.7", () => {
    expect(validateParticles({ effect: "snow", opacity: 2 }).opacity).toBe(0.7);
    expect(validateParticles({ effect: "snow", opacity: -0.5 }).opacity).toBe(0);
  });

  it("limits colors to max 4", () => {
    expect(
      validateParticles({
        effect: "sparkles",
        colors: ["#fff", "#000", "#f0f", "#aaa", "#bbb", "#ccc"]
      }).colors
    ).toHaveLength(4);
  });

  it("collapses unknown effect to 'none'", () => {
    expect(validateParticles({ effect: "fireworks" }).effect).toBe("none");
  });
});

describe("validateContent", () => {
  it("missing TAGLINE gets the default 'Together forever'", () => {
    const { valid } = validateContent({});
    expect(valid.TAGLINE).toBe(CONTENT_DEFAULTS.TAGLINE);
  });

  it("AI-provided copy overwrites defaults", () => {
    const { valid } = validateContent({ TAGLINE: "Written in the stars" });
    expect(valid.TAGLINE).toBe("Written in the stars");
  });

  it("rejects dangerous patterns in content strings", () => {
    const { valid, errors } = validateContent({
      STORY_HEADING: "<script>alert(1)</script>",
      STORY_QUOTE: "Clean quote"
    });
    expect(valid.STORY_HEADING).toBe(CONTENT_DEFAULTS.STORY_HEADING);
    expect(valid.STORY_QUOTE).toBe("Clean quote");
    expect(errors[0]).toMatch(/dangerous pattern/i);
  });

  it("ignores blank strings (keeps default)", () => {
    const { valid } = validateContent({ TAGLINE: "   " });
    expect(valid.TAGLINE).toBe(CONTENT_DEFAULTS.TAGLINE);
  });
});

describe("validateDangerousPatterns", () => {
  it("flags obvious script injection", () => {
    const hits = validateDangerousPatterns({
      nested: { deeper: "<script>alert(1)</script>" }
    });
    expect(hits.length).toBe(1);
  });

  it("returns [] for clean input", () => {
    expect(validateDangerousPatterns({ a: "hello", b: ["world"] })).toEqual([]);
  });

  it("tolerates circular references without throwing", () => {
    const obj: Record<string, unknown> = { a: "ok" };
    obj.self = obj;
    expect(() => validateDangerousPatterns(obj)).not.toThrow();
  });
});

describe("containsDangerousPattern", () => {
  it("matches every §10 pattern", () => {
    expect(containsDangerousPattern("javascript:alert(1)")).toBe(true);
    expect(containsDangerousPattern("expression(x)")).toBe(true);
    expect(containsDangerousPattern("<script>x</script>")).toBe(true);
    expect(containsDangerousPattern("@import url(x)")).toBe(true);
    expect(containsDangerousPattern("behaviour:url(x)")).toBe(true);
    expect(containsDangerousPattern("-moz-binding: url(x)")).toBe(true);
    expect(containsDangerousPattern("#C4607A")).toBe(false);
  });
});
