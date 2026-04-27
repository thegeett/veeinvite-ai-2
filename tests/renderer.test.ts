import { describe, expect, it } from "vitest";
import { render } from "@/lib/renderer";
import { buildCssFromTokens, buildFontsLink } from "@/lib/renderer/buildCssFromTokens";
import { injectStructured } from "@/lib/renderer/injectStructured";
import { smartDefaultsForProfile } from "@/lib/rsvp/config";
import { buildCulturalProfile } from "@/lib/cultural/library";
import type { CoupleData, EventData, RenderInput, ThemeJSON } from "@/lib/types";
import { FIXTURE_HERO, FIXTURE_SKELETON } from "./fixtures/skeleton";

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

function makeCouple(overrides: Partial<CoupleData> = {}): CoupleData {
  return {
    id: "couple-1",
    user_id: "user-1",
    slug: "meera-and-arjun",
    person1_name: "Meera",
    person2_name: "Arjun",
    wedding_date: "14 November 2025",
    wedding_date_iso: "2025-11-14T00:00:00Z",
    venue_name: "Rambagh Palace",
    venue_city: "Jaipur",
    rsvp_deadline: null,
    style: null,
    vibe: null,
    story: null,
    cultural_context: null,
    cultures: [],
    vibe_tags: [],
    expressive_palette: null,
    layout_id: "layout-1",
    cultural_profile: null,
    rsvp_config: null,
    global_tokens: null,
    theme_json: null,
    hero_html: null,
    design_summary: null,
    custom_sections: [],
    photo_urls: ["couple-1/hero.jpg", "couple-1/story.jpg"],
    site_html_url: null,
    is_published: false,
    created_at: "",
    updated_at: "",
    ...overrides
  };
}

function makeTheme(overrides: Partial<ThemeJSON> = {}): ThemeJSON {
  return {
    globalTokens: BASE_TOKENS,
    styles: {
      body: { background: "#0E0A0F", color: "rgba(253,246,238,0.9)" },
      ".hero-names": { color: "#C4607A", "font-family": "'Great Vibes'" },
      // Forbidden property — must not appear in output.
      ".story": { display: "flex", "padding-top": "4rem" }
    },
    fonts: ["Great Vibes", "Cormorant Garamond:400,700", "Comic Sans"],
    particles: { effect: "none", colors: [], count: 0, opacity: 0 },
    content: {
      TAGLINE: "Written in the stars",
      CTA_LABEL: "RSVP",
      FAQ_1_Q: "What should I wear?",
      FAQ_1_A: "Traditional Indian attire."
    },
    designSummary: "Midnight garden with rose accents",
    ...overrides
  };
}

function makeInput(overrides: Partial<RenderInput> = {}): RenderInput {
  return {
    layoutId: "layout-1",
    themeJson: makeTheme(),
    heroHtml: FIXTURE_HERO,
    culturalProfile: null,
    couple: makeCouple(),
    events: [],
    rsvpConfig: smartDefaultsForProfile(null, 2),
    customSections: [],
    ...overrides
  };
}

describe("renderer — core pipeline", () => {
  it("injectStructured runs last — DB names always resolve placeholders", () => {
    // AI content map accidentally lists wrong names (would happen if a
    // Call 2 regeneration drifted). DB is the source of truth.
    const theme = makeTheme({
      content: {
        ...makeTheme().content,
        // Simulate an AI attempt to set names via content (it shouldn't).
        PERSON1_NAME: "Raj",
        PERSON2_NAME: "Priya"
      }
    });
    const html = render(makeInput({ themeJson: theme }), { skeletonHtml: FIXTURE_SKELETON });
    // Hero + footer placeholders resolve to DB values.
    expect(html).toContain("Meera");
    expect(html).toContain("Arjun");
    // Structured injection runs AFTER content injection — the hallucinated
    // names in the content map never reach {{PERSON1_NAME}} positions.
    expect(html).not.toContain(">Raj<");
    expect(html).not.toContain(">Priya<");
    // Footer also has DB names.
    expect(html).toMatch(/<span>Meera &amp; Arjun<\/span>/);
  });

  it("strips forbidden CSS from output", () => {
    const html = render(makeInput(), { skeletonHtml: FIXTURE_SKELETON });
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).toMatch(/padding-top: 4rem/);
  });

  it("drops non-approved fonts from <link>", () => {
    const html = render(makeInput(), { skeletonHtml: FIXTURE_SKELETON });
    expect(html).toMatch(/fonts.googleapis.com/);
    expect(html).toContain("family=Great+Vibes");
    expect(html).not.toMatch(/Comic\+Sans/);
  });

  it("emits {{PHOTO:...}} markers — never raw Supabase URLs", () => {
    const heroWithPhoto = FIXTURE_HERO.replace("</section>", '<img src="{{PHOTO:0}}" alt=""></section>');
    const html = render(makeInput({ heroHtml: heroWithPhoto }), {
      skeletonHtml: FIXTURE_SKELETON
    });
    expect(html).not.toMatch(/supabase\.co\/storage/);
    expect(html).toContain("{{PHOTO:couple-1/hero.jpg}}");
  });

  it("replaces {{EVENTS_CARDS}} with event cards from events[] when no culture", () => {
    const events: EventData[] = [
      {
        id: "e1",
        couple_id: "couple-1",
        name: "Ceremony",
        event_type: null,
        event_date: "14 Nov",
        event_time: "5:00 PM",
        venue: "Garden",
        dress_code: null,
        sort_order: 0
      },
      {
        id: "e2",
        couple_id: "couple-1",
        name: "Reception",
        event_type: null,
        event_date: "14 Nov",
        event_time: "8:00 PM",
        venue: "Ballroom",
        dress_code: null,
        sort_order: 1
      }
    ];
    const html = render(makeInput({ events, rsvpConfig: smartDefaultsForProfile(null, 2) }), {
      skeletonHtml: FIXTURE_SKELETON
    });
    expect(html).not.toContain("{{EVENTS_CARDS}}");
    expect(html).toContain("Ceremony");
    expect(html).toContain("Reception");
    expect(html).toContain("Ballroom");
  });

  it("replaces {{EVENTS_CARDS}} with N ceremony cards from cultural profile", () => {
    const profile = buildCulturalProfile(
      "hindu_indian",
      "tamil",
      [],
      ["nischayathartham", "mangala_snanam", "wedding_ceremony", "reception"],
      {}
    );
    const html = render(makeInput({ culturalProfile: profile }), {
      skeletonHtml: FIXTURE_SKELETON
    });
    expect(html).toContain("Nischayathartham");
    expect(html).toContain("Mangala Snanam");
    // clamped at 6 max — we passed 4
    expect((html.match(/event-card/g) ?? []).length).toBe(4);
  });

  it("event cards fall back to couple.venue_name when ceremony venue is empty (bug fix 2026-04-26)", () => {
    // Cultural ceremonies don't carry a venue in the library — without the
    // fallback they showed "Venue to be announced" even though the couple
    // told us their venue in step 1.
    const profile = buildCulturalProfile(
      "hindu_indian",
      "tamil",
      [],
      ["nischayathartham"],
      {}
    );
    const html = render(
      makeInput({
        culturalProfile: profile,
        couple: makeCouple({ venue_name: "Rambagh Palace" })
      }),
      { skeletonHtml: FIXTURE_SKELETON }
    );
    expect(html).toContain("Rambagh Palace");
    expect(html).not.toContain("Venue to be announced");
  });

  it("matched EventData venue still beats couple.venue_name (precedence preserved)", () => {
    const profile = buildCulturalProfile(
      "hindu_indian",
      "tamil",
      [],
      ["nischayathartham"],
      {}
    );
    const events: EventData[] = [
      {
        id: "e1",
        couple_id: "couple-1",
        name: "Nischayathartham",
        event_type: "nischayathartham",
        event_date: "13 Nov",
        event_time: "10:00 AM",
        venue: "Family Home",
        dress_code: null,
        sort_order: 0
      }
    ];
    const html = render(
      makeInput({
        culturalProfile: profile,
        events,
        couple: makeCouple({ venue_name: "Rambagh Palace" })
      }),
      { skeletonHtml: FIXTURE_SKELETON }
    );
    expect(html).toContain("Family Home");
  });

  it("placeholder is shown only when no venue is anywhere in the chain", () => {
    // No cultural profile, no events with venue, no couple venue → placeholder visible.
    const html = render(
      makeInput({
        events: [
          {
            id: "e1",
            couple_id: "couple-1",
            name: "Ceremony",
            event_type: null,
            event_date: "14 Nov",
            event_time: "5:00 PM",
            venue: "",
            dress_code: null,
            sort_order: 0
          }
        ],
        couple: makeCouple({ venue_name: "" })
      }),
      { skeletonHtml: FIXTURE_SKELETON }
    );
    expect(html).toContain("Venue to be announced");
  });

  it("renders RSVP form in place of {{RSVP_FORM}}", () => {
    const html = render(makeInput({ rsvpConfig: smartDefaultsForProfile(null, 0) }), {
      skeletonHtml: FIXTURE_SKELETON
    });
    expect(html).not.toContain("{{RSVP_FORM}}");
    expect(html).toMatch(/<form[^>]*id="rsvp-form"/);
    expect(html).toContain("name=\"first_name\"");
  });

  it("is deterministic — same input returns same output", () => {
    const a = render(makeInput(), { skeletonHtml: FIXTURE_SKELETON });
    const b = render(makeInput(), { skeletonHtml: FIXTURE_SKELETON });
    expect(a).toBe(b);
  });

  it("renders Sikh Ik Onkar eyebrow with its glyph", () => {
    const profile = buildCulturalProfile(
      "sikh",
      undefined,
      ["sikh_religious_opening"],
      [],
      { religious_opening_text: "ੴ ਸਤਿ ਨਾਮੁ — Waheguru Ji Ka Khalsa" }
    );
    const html = render(makeInput({ culturalProfile: profile }), {
      skeletonHtml: FIXTURE_SKELETON
    });
    expect(html).toContain("ੴ");
    expect(html).toContain("Waheguru");
  });

  it("bilingual flag off — BILINGUAL placeholders resolve to empty", () => {
    const html = render(makeInput(), { skeletonHtml: FIXTURE_SKELETON });
    expect(html).not.toContain("{{PERSON1_NAME_BILINGUAL}}");
    expect(html).not.toContain("{{WEDDING_DATE_BILINGUAL}}");
  });

  it("no {{...}} placeholder leaks after render", () => {
    const profile = buildCulturalProfile(
      "hindu_indian",
      undefined,
      [],
      ["wedding_ceremony", "reception"],
      {}
    );
    const html = render(makeInput({ culturalProfile: profile }), {
      skeletonHtml: FIXTURE_SKELETON
    });
    // The only curly markers permitted at this point are photo markers.
    const leftover = html.match(/\{\{(?!PHOTO:)[^}]+\}\}/g) ?? [];
    expect(leftover).toEqual([]);
  });
});

describe("buildCssFromTokens", () => {
  it("emits selector blocks only when non-empty", () => {
    const css = buildCssFromTokens({
      body: { background: "#000" },
      ".empty": {}
    });
    expect(css).toContain("body {");
    expect(css).not.toContain(".empty");
  });
});

describe("buildFontsLink", () => {
  it("returns empty string for empty list", () => {
    expect(buildFontsLink([])).toBe("");
  });
  it("encodes family + weights", () => {
    const link = buildFontsLink(["Great Vibes", "Inter:400,600"]);
    expect(link).toContain("family=Great+Vibes");
    expect(link).toContain("family=Inter:wght@400;600");
  });
});

describe("injectStructured", () => {
  it("escapes HTML in couple names", () => {
    const html = injectStructured({
      html: `<p>{{PERSON1_NAME}}</p>`,
      couple: makeCouple({ person1_name: "<script>alert(1)</script>" })
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
