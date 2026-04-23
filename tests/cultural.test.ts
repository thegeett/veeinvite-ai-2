import { describe, expect, it } from "vitest";
import {
  buildCulturalProfile,
  buildCulturalPromptBlock,
  findConflicts,
  getCeremoniesForCouple,
  getCulture,
  loadLibrary
} from "@/lib/cultural/library";

describe("loadLibrary", () => {
  it("exposes a well-formed library with required cultures", () => {
    const lib = loadLibrary();
    expect(lib.cultures.hindu_indian).toBeTruthy();
    expect(lib.cultures.western).toBeTruthy();
    expect(lib.sectionTypes.hero_eyebrow).toMatch(/above couple names/i);
  });
});

describe("getCeremoniesForCouple — §26 algorithm", () => {
  it("hindu_indian / tamil matches the §26 Tamil expected output", () => {
    const ceremonies = getCeremoniesForCouple("hindu_indian", "tamil");
    const byId = Object.fromEntries(ceremonies.map((c) => [c.id, c]));

    // Pre-selected Tamil ceremonies
    const preSelected = ceremonies
      .filter((c) => c.displaySource === "subregion" && c.defaultIncluded)
      .map((c) => c.id);
    expect(preSelected).toContain("nischayathartham");
    expect(preSelected).toContain("mangala_snanam");
    expect(preSelected).toContain("oonjal");
    expect(preSelected).toContain("maalai_maatral");
    expect(preSelected).toContain("wedding_ceremony");
    expect(preSelected).toContain("reception");

    // "Also available" — defaults not in Tamil list should appear unselected
    const alsoAvailable = ceremonies.filter((c) => c.displaySource === "default");
    const alsoIds = alsoAvailable.map((c) => c.id);
    expect(alsoIds).toContain("sangeet");
    expect(alsoIds).toContain("baraat");
    expect(alsoIds).toContain("haldi");
    expect(alsoAvailable.every((c) => c.defaultIncluded === false)).toBe(true);

    // Tamil-specific "additional" options shown unselected
    const additional = ceremonies.filter((c) => c.displaySource === "additional");
    const addIds = additional.map((c) => c.id);
    expect(addIds).toContain("sumangali");
    expect(addIds).toContain("panda_kaal");

    // Names are Tamil-correct where overridden
    expect(byId.wedding_ceremony.name).toMatch(/Thiru Manam/);
  });

  it("no sub-region → default list passes through unchanged", () => {
    const hindu = getCeremoniesForCouple("hindu_indian");
    expect(hindu.every((c) => c.displaySource === "default")).toBe(true);
    expect(hindu.some((c) => c.id === "baraat" && c.defaultIncluded === false)).toBe(true);
  });

  it("unknown culture returns []", () => {
    expect(getCeremoniesForCouple("klingon")).toEqual([]);
  });
});

describe("buildCulturalProfile", () => {
  it("Tamil profile: copyGuardrails contains the 'never Sangeet' rule", () => {
    const profile = buildCulturalProfile("hindu_indian", "tamil", [], [], {});
    expect(profile.copyGuardrails).toMatch(/Never genericise/);
    expect(profile.subRegionCopyNote).toMatch(/Never use Sangeet, Pheras, Baraat/i);
  });

  it("Arab Muslim: copyGuardrails forbids alcohol + human figures", () => {
    const culture = getCulture("muslim");
    expect(culture?.copyGuardrails?.toLowerCase() ?? "").toMatch(/alcohol|no photos|human figures/);
  });

  it("confirmed content items + values round-trip", () => {
    const profile = buildCulturalProfile(
      "hindu_indian",
      undefined,
      ["hindu_brides_parents"],
      [],
      { brides_father_name: "Rajesh", brides_mother_name: "Sunita" }
    );
    const item = profile.contentItems.find((i) => i.id === "hindu_brides_parents");
    expect(item?.values.brides_father_name).toBe("Rajesh");
    expect(item?.values.brides_mother_name).toBe("Sunita");
  });
});

describe("buildCulturalPromptBlock", () => {
  it("includes COPY GUARDRAILS heading and the ceremonies list for non-Western profiles", () => {
    const profile = buildCulturalProfile(
      "hindu_indian",
      "tamil",
      [],
      ["nischayathartham", "wedding_ceremony"],
      {}
    );
    const block = buildCulturalPromptBlock(profile);
    expect(block).toMatch(/COPY GUARDRAILS/);
    expect(block).toMatch(/Nischayathartham/);
    expect(block).toMatch(/Never use Sangeet/);
  });

  it("Western or null → empty block", () => {
    const western = buildCulturalProfile("western", undefined, [], [], {});
    expect(buildCulturalPromptBlock(western)).toBe("");
    expect(buildCulturalPromptBlock(null)).toBe("");
  });
});

describe("findConflicts — interfaith", () => {
  it("surfaces duplicate hero_eyebrow slot (Hindu + Muslim)", () => {
    const hindu = buildCulturalProfile(
      "hindu_indian",
      undefined,
      ["hindu_religious_opening"],
      [],
      {}
    );
    const muslim = buildCulturalProfile(
      "muslim",
      "arab_muslim",
      ["muslim_bismillah"],
      [],
      {}
    );
    const conflicts = findConflicts([hindu, muslim]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].section).toBe("hero_eyebrow");
    expect(conflicts[0].items).toHaveLength(2);
  });

  it("same-culture duplicates are NOT flagged as interfaith conflicts", () => {
    const hindu = buildCulturalProfile(
      "hindu_indian",
      undefined,
      ["hindu_religious_opening"],
      [],
      {}
    );
    expect(findConflicts([hindu])).toEqual([]);
  });
});
