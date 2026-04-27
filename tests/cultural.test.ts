import { describe, expect, it } from "vitest";
import {
  buildCulturalProfile,
  buildCulturalPromptBlock,
  buildMergedCulturalProfile,
  findConflicts,
  getCeremoniesForCouple,
  getCulturePaletteRanges,
  getCulture,
  getWesternFamily,
  getWesternFamilyIds,
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

describe("buildMergedCulturalProfile — interfaith merge (bug fix 2026-04-26)", () => {
  it("empty selection list → null", () => {
    expect(buildMergedCulturalProfile([], {})).toBeNull();
  });

  it("single selection → equivalent to buildCulturalProfile", () => {
    const merged = buildMergedCulturalProfile(
      [
        {
          cultureId: "hindu_indian",
          subRegion: "tamil",
          confirmedContentItemIds: ["hindu_brides_parents"],
          confirmedCeremonyIds: ["nischayathartham"]
        }
      ],
      {}
    );
    const direct = buildCulturalProfile(
      "hindu_indian",
      "tamil",
      ["hindu_brides_parents"],
      ["nischayathartham"],
      {}
    );
    expect(merged).not.toBeNull();
    expect(merged!.id).toBe(direct.id);
    expect(merged!.displayName).toBe(direct.displayName);
    expect(merged!.copyGuardrails).toBe(direct.copyGuardrails);
    expect(merged!.contentItems.map((i) => i.id)).toEqual(
      direct.contentItems.map((i) => i.id)
    );
    expect(merged!.ceremonies.map((c) => c.id)).toEqual(
      direct.ceremonies.map((c) => c.id)
    );
  });

  it("primary culture wins for scalar/design fields", () => {
    const merged = buildMergedCulturalProfile(
      [
        { cultureId: "hindu_indian", confirmedContentItemIds: [], confirmedCeremonyIds: [] },
        { cultureId: "muslim", confirmedContentItemIds: [], confirmedCeremonyIds: [] }
      ],
      {}
    );
    const hindu = getCulture("hindu_indian");
    expect(merged!.id).toBe("hindu_indian");
    expect(merged!.displayName).toBe(hindu!.displayName);
    expect(merged!.designGuidance).toBe(hindu!.designGuidance);
    expect(merged!.copyTone).toBe(hindu!.copyTone);
  });

  it("copyGuardrails contains hard rules from both cultures", () => {
    // Hindu (primary) carries the "Never genericise sub-cultures" rule.
    // Muslim (secondary) carries alcohol / human-figure rules.
    // Both must apply because they are HARD constraints (CLAUDE.md §26).
    const merged = buildMergedCulturalProfile(
      [
        { cultureId: "hindu_indian", confirmedContentItemIds: [], confirmedCeremonyIds: [] },
        { cultureId: "muslim", confirmedContentItemIds: [], confirmedCeremonyIds: [] }
      ],
      {}
    );
    expect(merged!.copyGuardrails).toMatch(/Never genericise/i);
    expect(merged!.copyGuardrails.toLowerCase()).toMatch(/alcohol|human figures|no photos/);
  });

  it("contentItems from both cultures merged, deduplicated by id", () => {
    const merged = buildMergedCulturalProfile(
      [
        {
          cultureId: "hindu_indian",
          confirmedContentItemIds: ["hindu_brides_parents"],
          confirmedCeremonyIds: []
        },
        {
          cultureId: "muslim",
          confirmedContentItemIds: ["muslim_brides_parents"],
          confirmedCeremonyIds: []
        }
      ],
      {}
    );
    const ids = merged!.contentItems.map((i) => i.id);
    expect(ids).toContain("hindu_brides_parents");
    expect(ids).toContain("muslim_brides_parents");
    // No duplicates
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ceremonies from both cultures merged, deduplicated by id", () => {
    const merged = buildMergedCulturalProfile(
      [
        {
          cultureId: "hindu_indian",
          confirmedContentItemIds: [],
          confirmedCeremonyIds: ["sangeet"]
        },
        {
          cultureId: "sikh",
          confirmedContentItemIds: [],
          confirmedCeremonyIds: ["anand_karaj"]
        }
      ],
      {}
    );
    const ids = merged!.ceremonies.map((c) => c.id);
    expect(ids).toContain("sangeet");
    expect(ids).toContain("anand_karaj");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("same culture twice is idempotent (defensive)", () => {
    const single = buildMergedCulturalProfile(
      [{ cultureId: "hindu_indian", confirmedContentItemIds: [], confirmedCeremonyIds: [] }],
      {}
    );
    const doubled = buildMergedCulturalProfile(
      [
        { cultureId: "hindu_indian", confirmedContentItemIds: [], confirmedCeremonyIds: [] },
        { cultureId: "hindu_indian", confirmedContentItemIds: [], confirmedCeremonyIds: [] }
      ],
      {}
    );
    expect(doubled!.contentItems.length).toBe(single!.contentItems.length);
    expect(doubled!.ceremonies.length).toBe(single!.ceremonies.length);
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

// ============================================================================
// PALETTE-03 — Cultural library palette readers (Phase 3.2)
// ============================================================================

describe("getCulturePaletteRanges — sub-region + default fallback (PALETTE-03)", () => {
  it("returns Punjabi-specific ranges for hindu_indian + punjabi", () => {
    const ranges = getCulturePaletteRanges("hindu_indian", "punjabi");
    expect(ranges).not.toBeNull();
    // Punjabi bgPrimary is the deep Hindu red. Hue is in the high 340s.
    expect(ranges!.bgPrimary.h[0]).toBeGreaterThanOrEqual(340);
    expect(ranges!.bgPrimary.h[1]).toBeLessThanOrEqual(360);
    // Saturation is high (kumkum red is vivid).
    expect(ranges!.bgPrimary.s[0]).toBeGreaterThan(70);
    // Approved fonts present.
    expect(ranges!.fontDisplay.length).toBeGreaterThan(0);
  });

  it("returns Bengali-specific ranges with the cream/off-white accent", () => {
    const ranges = getCulturePaletteRanges("hindu_indian", "bengali");
    expect(ranges).not.toBeNull();
    // Bengali accent is white-cream, not rose. Phase 0 strengthened the note.
    // Saturation must be very low to read as cream.
    expect(ranges!.accent.s[1]).toBeLessThanOrEqual(40);
    // Lightness must be very high.
    expect(ranges!.accent.l[0]).toBeGreaterThanOrEqual(80);
  });

  it("falls back to default ranges when sub-region is not known", () => {
    const ranges = getCulturePaletteRanges("hindu_indian", "not_a_subregion");
    expect(ranges).not.toBeNull();
    // The default Hindu ranges should still be valid HSL bands.
    expect(typeof ranges!.bgPrimary.note).toBe("string");
  });

  it("returns default ranges when no sub-region is provided", () => {
    const ranges = getCulturePaletteRanges("hindu_indian");
    expect(ranges).not.toBeNull();
  });

  it("returns null for western (uses families instead)", () => {
    expect(getCulturePaletteRanges("western")).toBeNull();
  });

  it("returns null for an unknown culture id", () => {
    expect(getCulturePaletteRanges("klingon")).toBeNull();
  });
});

describe("getWesternFamily — aesthetic family ranges (PALETTE-03)", () => {
  it("returns botanical_garden ranges with bgPrimary, accent, gold, fontDisplay", () => {
    const family = getWesternFamily("botanical_garden");
    expect(family).not.toBeNull();
    expect(family!.bgPrimary).toBeDefined();
    expect(family!.accent).toBeDefined();
    expect(family!.gold).toBeDefined();
    expect(Array.isArray(family!.fontDisplay)).toBe(true);
    expect(family!.fontDisplay.length).toBeGreaterThan(0);
  });

  it("returns dark_romance with deep / saturated bgPrimary", () => {
    const family = getWesternFamily("dark_romance");
    expect(family).not.toBeNull();
    // Dark romance is moody: bgPrimary should be dark (low lightness).
    expect(family!.bgPrimary.l[1]).toBeLessThanOrEqual(40);
  });

  it("returns null for an unknown family id", () => {
    expect(getWesternFamily("not_a_real_family")).toBeNull();
  });
});

describe("getWesternFamilyIds — full canonical list (PALETTE-03)", () => {
  it("contains all 8 canonical family ids", () => {
    const ids = getWesternFamilyIds();
    const expected = [
      "botanical_garden",
      "dark_romance",
      "coastal_destination",
      "editorial_minimal",
      "warm_rustic",
      "french_luxury",
      "midnight_glamour",
      "scandinavian_clean"
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
    expect(ids).toHaveLength(8);
  });
});
