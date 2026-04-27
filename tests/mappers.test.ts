import { describe, expect, it } from "vitest";
import { rowToCouple } from "@/lib/db/mappers";

describe("rowToCouple — cultures column round-trip", () => {
  it("hydrates cultures: [] when the column is missing or null", () => {
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B"
      // cultures: undefined
    });
    expect(couple.cultures).toEqual([]);
  });

  it("preserves the original CultureSelection[] array", () => {
    const stored = [
      {
        cultureId: "hindu_indian",
        subRegion: "punjabi",
        confirmedContentItemIds: ["hindu_brides_parents"],
        confirmedCeremonyIds: ["sangeet", "anand_karaj"]
      },
      {
        cultureId: "jewish",
        confirmedContentItemIds: [],
        confirmedCeremonyIds: ["chuppah"]
      }
    ];
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B",
      cultures: stored
    });
    expect(couple.cultures).toEqual(stored);
    expect(couple.cultures).toHaveLength(2);
    expect(couple.cultures[0].cultureId).toBe("hindu_indian");
    expect(couple.cultures[1].cultureId).toBe("jewish");
  });

  it("non-array values fall back to empty list (defensive)", () => {
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B",
      cultures: "not-an-array"
    });
    expect(couple.cultures).toEqual([]);
  });
});

// Phase 1 (PALETTE-01) — vibe_tags + expressive_palette columns added in
// migration 003_add_vibe_tags. These tests are written before the mapper is
// updated; they fail until rowToCouple hydrates the new columns.

describe("rowToCouple — vibe_tags column round-trip", () => {
  it("hydrates vibe_tags: [] when the column is missing or null", () => {
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B"
      // vibe_tags: undefined
    });
    expect(couple.vibe_tags).toEqual([]);
  });

  it("preserves the selected tag array", () => {
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B",
      vibe_tags: ["romantic", "soft", "intimate"]
    });
    expect(couple.vibe_tags).toEqual(["romantic", "soft", "intimate"]);
  });

  it("non-array values fall back to empty list (defensive)", () => {
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B",
      vibe_tags: "romantic,soft"
    });
    expect(couple.vibe_tags).toEqual([]);
  });
});

describe("rowToCouple — expressive_palette column round-trip", () => {
  it("hydrates expressive_palette: null when the column is missing", () => {
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B"
    });
    expect(couple.expressive_palette).toBeNull();
  });

  it("preserves the 4-token palette object", () => {
    const stored = {
      bgPrimary: "hsl(348, 88%, 16%)",
      accent: "hsl(342, 60%, 56%)",
      gold: "hsl(44, 90%, 54%)",
      fontDisplay: "Great Vibes"
    };
    const couple = rowToCouple({
      id: "c1",
      user_id: "u1",
      slug: "a-and-b",
      person1_name: "A",
      person2_name: "B",
      expressive_palette: stored
    });
    expect(couple.expressive_palette).toEqual(stored);
    expect(couple.expressive_palette?.fontDisplay).toBe("Great Vibes");
  });
});
