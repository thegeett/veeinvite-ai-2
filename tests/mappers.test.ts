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
