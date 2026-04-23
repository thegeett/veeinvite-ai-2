import { describe, expect, it } from "vitest";
import { selectLayout } from "@/lib/layoutSelector";
import { buildCulturalProfile } from "@/lib/cultural/library";

describe("selectLayout — §25 decision tree", () => {
  it("Tamil culture + no style card → layout-3", () => {
    const profile = buildCulturalProfile("hindu_indian", "tamil", [], [], {});
    const { layoutId } = selectLayout({ culturalProfile: profile, isStep1: true });
    expect(layoutId).toBe("layout-3");
  });

  it("Tamil culture + 'Modern Minimalist' → layout-1 (style card wins)", () => {
    const profile = buildCulturalProfile("hindu_indian", "tamil", [], [], {});
    const { layoutId, reason } = selectLayout({
      styleCard: "Modern Minimalist",
      culturalProfile: profile,
      isStep1: false
    });
    expect(layoutId).toBe("layout-1");
    expect(reason).toMatch(/wins over/i);
  });

  it("no culture + no style card → layout-1", () => {
    const { layoutId, reason } = selectLayout({ isStep1: true });
    expect(layoutId).toBe("layout-1");
    expect(reason).toMatch(/Default/i);
  });

  it("Jewish profile → layout-2 (romantic traditional)", () => {
    const profile = buildCulturalProfile("jewish", undefined, [], [], {});
    expect(selectLayout({ culturalProfile: profile, isStep1: true }).layoutId).toBe("layout-2");
  });

  it("Chinese profile → layout-4 (editorial/bold)", () => {
    const profile = buildCulturalProfile("chinese", undefined, [], [], {});
    expect(selectLayout({ culturalProfile: profile, isStep1: true }).layoutId).toBe("layout-4");
  });

  it("'Editorial Bold' style card → layout-4 regardless of culture", () => {
    const profile = buildCulturalProfile("western", undefined, [], [], {});
    expect(
      selectLayout({
        styleCard: "Editorial Bold",
        culturalProfile: profile,
        isStep1: false
      }).layoutId
    ).toBe("layout-4");
  });

  it("unknown culture id falls through to layout-1", () => {
    const profile = buildCulturalProfile("klingon", undefined, [], [], {});
    expect(selectLayout({ culturalProfile: profile, isStep1: true }).layoutId).toBe("layout-1");
  });
});
