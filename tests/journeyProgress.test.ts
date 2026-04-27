import { describe, expect, it } from "vitest";
import { computeReachable, hrefFor } from "@/components/journey/helpers";

describe("computeReachable — wizard step gating (plan §34.4)", () => {
  it("null couple → only Step 1 reachable (Steps 2, 3, 4 locked)", () => {
    expect(computeReachable(null)).toEqual({ 2: false, 3: false, 4: false });
  });

  it("couple exists but no theme_json → Step 2 unlocks, Step 3 still locked", () => {
    expect(computeReachable({ theme_json: null })).toEqual({
      2: true,
      3: false,
      4: false
    });
  });

  it("couple has theme_json → Step 2 + Step 3 unlocked, Step 4 still Coming soon", () => {
    expect(computeReachable({ theme_json: { fake: "theme" } })).toEqual({
      2: true,
      3: true,
      4: false
    });
  });

  it("Step 4 stays locked regardless of state (Guests not built yet)", () => {
    expect(computeReachable({ theme_json: { x: 1 } })[4]).toBe(false);
    expect(computeReachable(null)[4]).toBe(false);
  });
});

describe("hrefFor — wizard step routing (plan §34.4)", () => {
  it("Step 1 always routes to /onboarding (no params required)", () => {
    expect(hrefFor(1, undefined, undefined)).toBe("/onboarding");
    expect(hrefFor(1, "couple-123", "priya-and-arjun")).toBe("/onboarding");
  });

  it("Step 2 requires couple_id — returns null when missing", () => {
    expect(hrefFor(2, undefined, undefined)).toBeNull();
    expect(hrefFor(2, undefined, "some-slug")).toBeNull();
  });

  it("Step 2 builds /onboarding/step-2 with couple + slug query params", () => {
    expect(hrefFor(2, "couple-123", "priya-and-arjun")).toBe(
      "/onboarding/step-2?couple=couple-123&slug=priya-and-arjun"
    );
  });

  it("Step 2 with no slug uses an empty slug param", () => {
    expect(hrefFor(2, "couple-123", undefined)).toBe(
      "/onboarding/step-2?couple=couple-123&slug="
    );
  });

  it("Step 3 requires couple_id — returns null when missing", () => {
    expect(hrefFor(3, undefined, undefined)).toBeNull();
  });

  it("Step 3 builds /dashboard with couple + slug query params", () => {
    expect(hrefFor(3, "couple-123", "priya-and-arjun")).toBe(
      "/dashboard?couple=couple-123&slug=priya-and-arjun"
    );
  });

  it("Step 4 always returns null (Coming soon — Guests not built)", () => {
    expect(hrefFor(4, undefined, undefined)).toBeNull();
    expect(hrefFor(4, "couple-123", "priya-and-arjun")).toBeNull();
  });
});
