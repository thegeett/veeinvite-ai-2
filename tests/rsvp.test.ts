import { describe, expect, it } from "vitest";
import { buildRSVPForm, smartDefaultsForProfile } from "@/lib/rsvp/config";
import { buildCulturalProfile } from "@/lib/cultural/library";
import type { EventData } from "@/lib/types";

function event(id: string, name: string): EventData {
  return {
    id,
    couple_id: "c",
    name,
    event_type: null,
    event_date: "14 Nov",
    event_time: "5pm",
    venue: "Hall",
    dress_code: null,
    sort_order: 0
  };
}

describe("smartDefaultsForProfile", () => {
  it("Hindu profile → 10-guest form, childrenSeparate, eventSelection when multi-event", () => {
    const profile = buildCulturalProfile("hindu_indian", undefined, [], [], {});
    const cfg = smartDefaultsForProfile(profile, 3);
    expect(cfg.guestCountMax).toBe(10);
    expect(cfg.childrenSeparate).toBe(true);
    expect(cfg.eventSelectionEnabled).toBe(true);
  });

  it("Western single-event → 4-guest form, no event selection", () => {
    const profile = buildCulturalProfile("western", undefined, [], [], {});
    const cfg = smartDefaultsForProfile(profile, 1);
    expect(cfg.guestCountMax).toBe(4);
    expect(cfg.eventSelectionEnabled).toBe(false);
  });

  it("Chinese → meal choice enabled with Standard/Vegetarian options", () => {
    const profile = buildCulturalProfile("chinese", undefined, [], [], {});
    const cfg = smartDefaultsForProfile(profile, 2);
    expect(cfg.mealChoiceEnabled).toBe(true);
    expect(cfg.mealOptions).toContain("Standard");
    expect(cfg.mealOptions).toContain("Vegetarian");
  });

  it("null profile → eventSelectionEnabled flips on ≥2 events", () => {
    expect(smartDefaultsForProfile(null, 1).eventSelectionEnabled).toBe(false);
    expect(smartDefaultsForProfile(null, 2).eventSelectionEnabled).toBe(true);
  });
});

describe("buildRSVPForm", () => {
  it("includes the first+last name row and email and attendance options", () => {
    const cfg = smartDefaultsForProfile(null, 0);
    const html = buildRSVPForm(cfg, []);
    expect(html).toMatch(/name="first_name"/);
    expect(html).toMatch(/name="last_name"/);
    expect(html).toMatch(/name="email"/);
    expect(html).toMatch(/name="attending"/);
  });

  it("renders 10 guest options for Hindu profile", () => {
    const profile = buildCulturalProfile("hindu_indian", undefined, [], [], {});
    const cfg = smartDefaultsForProfile(profile, 3);
    const html = buildRSVPForm(cfg, [event("e1", "Mehendi"), event("e2", "Reception")]);
    const guestOptions = html.match(/<option value="\d+">\d+<\/option>/g) ?? [];
    expect(guestOptions.length).toBeGreaterThanOrEqual(10);
    expect(html).toMatch(/name="children_count"/);
    // event checkboxes
    expect(html).toMatch(/name="events_attending"/);
  });

  it("omits event checkboxes for single-event profile", () => {
    const cfg = smartDefaultsForProfile(null, 1);
    const html = buildRSVPForm(cfg, [event("e1", "Ceremony")]);
    expect(html).not.toMatch(/events_attending/);
  });
});
