// Phase 1 (PALETTE-01) — TDD scaffold for vibeTagPicker module.
// These tests are written before the module exists. Initial run is expected to
// fail with module-not-found errors. Phase 1.3 makes them pass.

import { describe, expect, it } from "vitest";
import {
  WESTERN_TAG_MAP,
  CULTURAL_TAG_MAP,
  WESTERN_TAGS,
  CULTURAL_TAGS,
  WESTERN_FAMILY_IDS,
  selectWesternFamily,
  applyVibeTagsToWeight,
  type WesternFamilyId
} from "@/lib/ai/vibeTagPicker";
import type { DesignWeight } from "@/lib/types";

// ============================================================================
// selectWesternFamily — scoring + tie-break
// ============================================================================

describe("selectWesternFamily — picks the right family from tags", () => {
  it("[romantic, soft] with romantic_traditional → botanical_garden", () => {
    // romantic → botanical_garden + dark_romance (each +1)
    // soft     → botanical_garden + french_luxury (each +1)
    // botanical_garden wins outright at score 2.
    expect(selectWesternFamily("romantic_traditional", ["romantic", "soft"]))
      .toBe("botanical_garden");
  });

  it("[bold, moody] with editorial_bold → editorial_minimal (style card breaks tie)", () => {
    // bold  → editorial_minimal + midnight_glamour
    // moody → dark_romance
    // Tied at 1 between editorial_minimal, midnight_glamour, dark_romance.
    // Style card editorial_bold prefers editorial_minimal.
    expect(selectWesternFamily("editorial_bold", ["bold", "moody"]))
      .toBe("editorial_minimal");
  });

  it("[coastal] → coastal_destination (single-mapped tag wins outright)", () => {
    expect(selectWesternFamily("destination_glamour", ["coastal"]))
      .toBe("coastal_destination");
  });

  it("[romantic, elegant] tied 2-way → style card breaks tie", () => {
    // romantic → botanical_garden + dark_romance
    // elegant  → french_luxury    + midnight_glamour
    // 4-way tie at 1. romantic_traditional style card prefers botanical_garden.
    expect(selectWesternFamily("romantic_traditional", ["romantic", "elegant"]))
      .toBe("botanical_garden");
  });
});

describe("selectWesternFamily — fallbacks", () => {
  it("empty tag list → falls back to style card", () => {
    expect(selectWesternFamily("editorial_bold", []))
      .toBe("editorial_minimal");
    expect(selectWesternFamily("romantic_traditional", []))
      .toBe("botanical_garden");
  });

  it("tags with no matches → falls back to style card", () => {
    // "beautiful" / "happy" / "love" are exactly the kind of words couples
    // typed into the old free-text input. None appear in WESTERN_TAG_MAP.
    expect(selectWesternFamily("editorial_bold", ["beautiful", "happy", "love"]))
      .toBe("editorial_minimal");
  });

  it("unknown style card and empty tags → safe default (botanical_garden)", () => {
    expect(selectWesternFamily("not_a_real_style", []))
      .toBe("botanical_garden");
  });
});

// ============================================================================
// applyVibeTagsToWeight — design weight composition
// ============================================================================

const BASE_WEIGHT: DesignWeight = {
  motifIntensity: "medium",
  density: "balanced",
  materialType: "silk",
  animationLevel: "gentle"
};

describe("applyVibeTagsToWeight — vibrant changes ONLY animationLevel", () => {
  // The plan §34 / VIBE_TAG_PICKER_SPEC explicitly call this out as a
  // correction from a prior version where vibrant pushed density to ornate.
  // Vibrancy = energy/movement, NOT quantity of ornament. This test pins it.
  it("vibrant lifts animationLevel to ambient — leaves density and motifIntensity untouched", () => {
    const result = applyVibeTagsToWeight(BASE_WEIGHT, ["vibrant"]);
    expect(result.animationLevel).toBe("ambient");
    expect(result.density).toBe(BASE_WEIGHT.density);
    expect(result.motifIntensity).toBe(BASE_WEIGHT.motifIntensity);
    expect(result.materialType).toBe(BASE_WEIGHT.materialType);
  });
});

describe("applyVibeTagsToWeight — other tags compose correctly", () => {
  it("contemporary pushes density and motifIntensity down, swaps to marble", () => {
    const ornate: DesignWeight = {
      motifIntensity: "prominent",
      density: "ornate",
      materialType: "velvet",
      animationLevel: "ambient"
    };
    const result = applyVibeTagsToWeight(ornate, ["contemporary"]);
    expect(result.density).toBe("minimal");
    expect(result.motifIntensity).toBe("subtle");
    expect(result.materialType).toBe("marble");
    expect(result.animationLevel).toBe("ambient"); // not touched by contemporary
  });

  it("grand pushes everything up — density:ornate, motif:prominent, animation:ambient", () => {
    const minimal: DesignWeight = {
      motifIntensity: "subtle",
      density: "minimal",
      materialType: "marble",
      animationLevel: "static"
    };
    const result = applyVibeTagsToWeight(minimal, ["grand"]);
    expect(result.density).toBe("ornate");
    expect(result.motifIntensity).toBe("prominent");
    expect(result.animationLevel).toBe("ambient");
  });

  it("intimate is the inverse of grand — pushes density and motif down, animation gentle", () => {
    const ornate: DesignWeight = {
      motifIntensity: "prominent",
      density: "ornate",
      materialType: "velvet",
      animationLevel: "ambient"
    };
    const result = applyVibeTagsToWeight(ornate, ["intimate"]);
    expect(result.density).toBe("minimal");
    expect(result.motifIntensity).toBe("subtle");
    expect(result.animationLevel).toBe("gentle");
  });

  it("multiple tags compose left-to-right — last tag wins on conflicting fields", () => {
    // grand pushes density: ornate; refined pushes density: minimal.
    // Applied in order [grand, refined], refined's pass wins.
    const result = applyVibeTagsToWeight(BASE_WEIGHT, ["grand", "refined"]);
    expect(result.density).toBe("minimal");
    expect(result.motifIntensity).toBe("subtle"); // refined wins
    expect(result.materialType).toBe("marble");   // refined sets this
  });

  it("empty tag list returns base weight unchanged", () => {
    const result = applyVibeTagsToWeight(BASE_WEIGHT, []);
    expect(result).toEqual(BASE_WEIGHT);
  });

  it("unknown tag is silently ignored — no throw, no change", () => {
    const result = applyVibeTagsToWeight(BASE_WEIGHT, ["not_a_tag"]);
    expect(result).toEqual(BASE_WEIGHT);
  });
});

// ============================================================================
// Tag library shape — make sure the constants are well-formed
// ============================================================================

describe("WESTERN_TAGS — 12 entries, well-formed", () => {
  it("contains exactly 12 tags", () => {
    expect(WESTERN_TAGS).toHaveLength(12);
  });

  it("each tag has id, label, families[], preview.swatches[3], preview.keywords", () => {
    for (const tag of WESTERN_TAGS) {
      expect(typeof tag.id).toBe("string");
      expect(typeof tag.label).toBe("string");
      expect(Array.isArray(tag.families)).toBe(true);
      expect(tag.families.length).toBeGreaterThan(0);
      expect(tag.preview.swatches).toHaveLength(3);
      expect(typeof tag.preview.keywords).toBe("string");
    }
  });

  it("ids are unique", () => {
    const ids = WESTERN_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("none of the dropped synonym ids appear (Minimal, Classic, Festive, Organic)", () => {
    const ids = WESTERN_TAGS.map((t) => t.id.toLowerCase());
    expect(ids).not.toContain("minimal");
    expect(ids).not.toContain("classic");
    expect(ids).not.toContain("festive");
    expect(ids).not.toContain("organic");
  });
});

describe("CULTURAL_TAGS — 8 entries, well-formed", () => {
  it("contains exactly 8 tags", () => {
    expect(CULTURAL_TAGS).toHaveLength(8);
  });

  it("each tag has id, label, description, preview.keywords, decoration, motion", () => {
    for (const tag of CULTURAL_TAGS) {
      expect(typeof tag.id).toBe("string");
      expect(typeof tag.label).toBe("string");
      expect(typeof tag.description).toBe("string");
      expect(typeof tag.preview.keywords).toBe("string");
      expect(typeof tag.preview.decoration).toBe("number");
      expect(typeof tag.preview.motion).toBe("number");
    }
  });

  it("vibrant has decoration:0 and motion:3 — matches the corrected animation-only semantic", () => {
    const vibrant = CULTURAL_TAGS.find((t) => t.id === "vibrant");
    expect(vibrant).toBeDefined();
    expect(vibrant!.preview.decoration).toBe(0);
    expect(vibrant!.preview.motion).toBe(3);
  });

  it("grand and festive both have decoration:5 and motion:3", () => {
    const grand = CULTURAL_TAGS.find((t) => t.id === "grand");
    const festive = CULTURAL_TAGS.find((t) => t.id === "festive");
    expect(grand!.preview.decoration).toBe(5);
    expect(grand!.preview.motion).toBe(3);
    expect(festive!.preview.decoration).toBe(5);
    expect(festive!.preview.motion).toBe(3);
  });
});

describe("WESTERN_FAMILY_IDS — all 8 families listed", () => {
  it("contains the 8 canonical family ids", () => {
    const expected: WesternFamilyId[] = [
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
      expect(WESTERN_FAMILY_IDS).toContain(id);
    }
    expect(WESTERN_FAMILY_IDS).toHaveLength(8);
  });
});

describe("WESTERN_TAG_MAP — every western tag is mapped", () => {
  it("every WESTERN_TAGS.id is a key in WESTERN_TAG_MAP", () => {
    for (const tag of WESTERN_TAGS) {
      expect(WESTERN_TAG_MAP[tag.id]).toBeDefined();
      expect(Array.isArray(WESTERN_TAG_MAP[tag.id])).toBe(true);
    }
  });

  it("every mapped family is a valid WesternFamilyId", () => {
    for (const families of Object.values(WESTERN_TAG_MAP)) {
      for (const f of families) {
        expect(WESTERN_FAMILY_IDS).toContain(f);
      }
    }
  });
});

describe("CULTURAL_TAG_MAP — every cultural tag is mapped, vibrant only adjusts animation", () => {
  it("every CULTURAL_TAGS.id is a key in CULTURAL_TAG_MAP", () => {
    for (const tag of CULTURAL_TAGS) {
      expect(CULTURAL_TAG_MAP[tag.id]).toBeDefined();
    }
  });

  it("vibrant's adjustment object has only animationLevel", () => {
    const adj = CULTURAL_TAG_MAP["vibrant"];
    expect(adj).toBeDefined();
    expect(Object.keys(adj!)).toEqual(["animationLevel"]);
    expect(adj!.animationLevel).toBe("ambient");
  });
});
