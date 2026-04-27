// End-to-end pipeline test — uses themeOverride + heroOverride to skip the
// Anthropic calls so the test is deterministic and offline.

import { describe, expect, it } from "vitest";
import { generateSite } from "@/lib/pipeline";
import type { CoupleData, ThemeJSON } from "@/lib/types";

const BASE_TOKENS: ThemeJSON["globalTokens"] = {
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
};

const THEME: ThemeJSON = {
  globalTokens: BASE_TOKENS,
  styles: { body: { background: BASE_TOKENS.bgPrimary, color: BASE_TOKENS.textPrimary } },
  fonts: ["Great Vibes", "Cormorant Garamond:400,700", "Jost:400,500"],
  particles: { effect: "none", colors: [], count: 0, opacity: 0 },
  content: {
    TAGLINE: "Written in the stars",
    CTA_LABEL: "RSVP",
    RSVP_SUBMIT_LABEL: "Send with Love",
    RSVP_ACCEPT_LABEL: "Joyfully accepts",
    RSVP_DECLINE_LABEL: "Regretfully declines"
  },
  designSummary: "Midnight garden with rose accents"
};

const HERO = `<section class="hero">
  <div class="hero-inner">
    <h1 class="hero-names">{{PERSON1_NAME}} &amp; {{PERSON2_NAME}}</h1>
    <p class="hero-tagline">{{TAGLINE}}</p>
    <p class="hero-date">{{WEDDING_DATE_DISPLAY}} · {{VENUE_NAME}}</p>
    <a class="hero-cta" href="#rsvp">{{CTA_LABEL}}</a>
  </div>
</section>`;

function makeCouple(overrides: Partial<CoupleData> = {}): CoupleData {
  return {
    id: "c1",
    user_id: "u1",
    slug: "meera-and-arjun",
    person1_name: "Meera",
    person2_name: "Arjun",
    wedding_date: "14 November 2025",
    wedding_date_iso: "2025-11-14T00:00:00Z",
    venue_name: "Rambagh Palace",
    venue_city: "Jaipur",
    rsvp_deadline: null,
    style: "South Asian Grand",
    vibe: "grand, festive, ornate",
    story: null,
    cultural_context: "hindu_indian",
    cultures: [],
    vibe_tags: [],
    expressive_palette: null,
    layout_id: null,
    cultural_profile: null,
    rsvp_config: null,
    global_tokens: null,
    theme_json: null,
    hero_html: null,
    design_summary: null,
    custom_sections: [],
    photo_urls: [],
    site_html_url: null,
    is_published: false,
    created_at: "",
    updated_at: "",
    ...overrides
  };
}

describe("generateSite — end-to-end bundle", () => {
  it("produces a bundle given Hindu-Tamil step-2 quiz answers", async () => {
    const couple = makeCouple();
    const result = await generateSite({
      quizAnswers: {
        person1_name: couple.person1_name,
        person2_name: couple.person2_name,
        wedding_date: couple.wedding_date,
        wedding_date_iso: couple.wedding_date_iso,
        venue_name: couple.venue_name,
        venue_city: couple.venue_city,
        styleCard: "South Asian Grand",
        vibeTags: ["grand", "festive", "ornate"],
        cultures: [
          {
            cultureId: "hindu_indian",
            subRegion: "tamil",
            confirmedContentItemIds: ["hindu_religious_opening", "hindu_brides_parents"],
            confirmedCeremonyIds: [
              "nischayathartham",
              "mangala_snanam",
              "wedding_ceremony",
              "reception"
            ]
          }
        ],
        contentValues: {
          religious_opening_text: "|| Shree Ganeshaya Namah ||",
          brides_father_name: "Mr. Rajesh",
          brides_mother_name: "Mrs. Sunita"
        },
        events: []
      },
      couple,
      events: [],
      themeOverride: THEME,
      heroOverride: HERO
    });

    expect(result.layoutId).toBe("layout-3");
    expect(result.culturalProfile?.id).toBe("hindu_indian");
    expect(result.html).toContain("Meera");
    expect(result.html).toContain("Arjun");
    expect(result.html).toContain("Rambagh Palace");
    // Tamil ceremony
    expect(result.html).toContain("Nischayathartham");
    // Religious opening landed in hero area
    expect(result.html).toContain("Shree Ganeshaya Namah");
    // No placeholder leaks except photo markers (couple has no photos).
    const leftover = result.html.match(/\{\{(?!PHOTO:)[^}]+\}\}/g) ?? [];
    expect(leftover).toEqual([]);
    // No raw Supabase URLs.
    expect(result.html).not.toMatch(/supabase\.co\/storage/);
  });

  it("Western fallback: no culture → layout-1", async () => {
    const couple = makeCouple({
      style: null,
      vibe: null,
      cultural_context: null
    });
    const result = await generateSite({
      quizAnswers: {
        person1_name: couple.person1_name,
        person2_name: couple.person2_name,
        wedding_date: couple.wedding_date,
        wedding_date_iso: couple.wedding_date_iso,
        venue_name: couple.venue_name,
        venue_city: couple.venue_city
      },
      couple,
      themeOverride: THEME,
      heroOverride: HERO
    });
    expect(result.layoutId).toBe("layout-1");
    expect(result.culturalProfile).toBeNull();
  });
});
