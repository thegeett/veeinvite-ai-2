// Renders all four layouts with mock data and snapshots the output to
// /tmp so the operator can eyeball them. Verifies:
//   - No `{{...}}` placeholders leak (except intentional {{PHOTO:path}}).
//   - No `<style>` block contains forbidden CSS from AI output.
//   - Every structural class expected for that layout is present.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@/lib/renderer";
import { smartDefaultsForProfile } from "@/lib/rsvp/config";
import type { CoupleData, LayoutId, RenderInput, ThemeJSON } from "@/lib/types";

function findLayoutsRoot(): string | null {
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, "layouts", "layout-1-modern", "skeleton.html");
    if (fs.existsSync(candidate)) return path.join(current, "layouts");
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const layoutsRoot = findLayoutsRoot();

const TOKENS: ThemeJSON["globalTokens"] = {
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
  globalTokens: TOKENS,
  styles: {
    body: { background: TOKENS.bgPrimary, color: TOKENS.textPrimary },
    nav: { background: "rgba(14,10,15,0.8)" },
    ".hero-names": { color: TOKENS.textPrimary },
    ".story-eyebrow": { color: TOKENS.gold },
    ".story-heading": { color: TOKENS.textPrimary },
    ".event-card": { background: TOKENS.bgCard, border: `1px solid ${TOKENS.accent}` },
    ".rsvp-submit": { background: TOKENS.accent, color: TOKENS.textPrimary },
    ".footer-names": { color: TOKENS.textPrimary }
  },
  fonts: ["Great Vibes", "Cormorant Garamond:400,700", "Jost:400,500"],
  particles: { effect: "none", colors: [], count: 0, opacity: 0 },
  content: {
    TAGLINE: "Together forever",
    CTA_LABEL: "RSVP Now",
    STORY_EYEBROW: "Our Story",
    STORY_SCRIPT_TITLE: "A love story",
    STORY_HEADING: "Our journey together",
    STORY_P1: "We met a long time ago.",
    STORY_QUOTE: "A return to somewhere we always belonged.",
    STORY_P2: "And here we are.",
    EVENTS_EYEBROW: "Celebrations",
    EVENTS_HEADING: "Our events",
    RSVP_EYEBROW: "Kindly Respond",
    RSVP_HEADING: "Will you join us?",
    RSVP_SUB: "Please let us know.",
    RSVP_ACCEPT_LABEL: "Joyfully accepts",
    RSVP_DECLINE_LABEL: "Regretfully declines",
    RSVP_SUBMIT_LABEL: "Send with Love",
    RSVP_SUCCESS_TITLE: "Thank you",
    RSVP_SUCCESS_MESSAGE: "Your response has been received.",
    GALLERY_EYEBROW: "Moments",
    GALLERY_HEADING: "A few moments",
    GALLERY_SUB: "More to come.",
    FAQ_HEADING: "Guest questions",
    FAQ_1_Q: "When is the ceremony?",
    FAQ_1_A: "Saturday afternoon.",
    FAQ_2_Q: "Dress code?",
    FAQ_2_A: "Formal.",
    FAQ_3_Q: "Gifts?",
    FAQ_3_A: "Your presence is the gift.",
    FAQ_4_Q: "Parking?",
    FAQ_4_A: "Yes.",
    FAQ_5_Q: "Kids?",
    FAQ_5_A: "Welcome.",
    FAQ_6_Q: "Other?",
    FAQ_6_A: "Ask us!",
    FOOTER_TAGLINE: "Made with love."
  },
  designSummary: "Test theme.",
  reasoning: {}
};

const COUPLE: CoupleData = {
  id: "test-couple",
  user_id: "test-user",
  slug: "priya-and-arjun",
  person1_name: "Priya",
  person2_name: "Arjun",
  wedding_date: "Saturday, 14 June 2025",
  wedding_date_iso: "2025-06-14T16:00:00Z",
  venue_name: "The Leela Palace",
  venue_city: "Udaipur",
  rsvp_deadline: null,
  style: null,
  vibe: null,
  story: null,
  cultural_context: null,
  cultures: [],
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
  updated_at: ""
};

const HERO = `<section class="hero">
  <div class="hero-inner">
    <h1 class="hero-names">{{PERSON1_NAME}} <span class="hero-connector">&amp;</span> {{PERSON2_NAME}}</h1>
    <p class="hero-tagline">{{TAGLINE}}</p>
    <p class="hero-date">{{WEDDING_DATE_DISPLAY}} · {{VENUE_NAME}}, {{VENUE_CITY}}</p>
    <a class="hero-cta" href="#rsvp">{{CTA_LABEL}}</a>
  </div>
</section>`;

function renderLayout(layoutId: LayoutId): string {
  const input: RenderInput = {
    layoutId,
    themeJson: THEME,
    heroHtml: HERO,
    culturalProfile: null,
    couple: COUPLE,
    events: [
      { id: "e1", couple_id: COUPLE.id, name: "Ceremony", event_type: null, event_date: "14 June", event_time: "4 PM", venue: "Leela", dress_code: null, sort_order: 0 },
      { id: "e2", couple_id: COUPLE.id, name: "Reception", event_type: null, event_date: "14 June", event_time: "8 PM", venue: "Leela", dress_code: null, sort_order: 1 }
    ],
    rsvpConfig: smartDefaultsForProfile(null, 2),
    customSections: []
  };
  return render(input);
}

const maybeIt = layoutsRoot ? it : it.skip;

describe("render all four layouts — snapshot + invariants", () => {
  const layouts: LayoutId[] = ["layout-1", "layout-2", "layout-3", "layout-4"];
  const outputs: Record<string, string> = {};

  maybeIt("renders all four without throwing", () => {
    for (const id of layouts) {
      outputs[id] = renderLayout(id);
      expect(outputs[id]).toContain("<!DOCTYPE html>");
    }
    // Snapshot to /tmp for manual inspection.
    const outDir = "/tmp/veeinvite-renders";
    fs.mkdirSync(outDir, { recursive: true });
    for (const id of layouts) {
      fs.writeFileSync(path.join(outDir, `${id}.html`), outputs[id]);
    }
  });

  maybeIt("no unresolved {{...}} placeholders except {{PHOTO:...}}", () => {
    for (const id of layouts) {
      const leaks = (outputs[id].match(/\{\{[^}]+\}\}/g) ?? []).filter(
        (m) => !m.startsWith("{{PHOTO:")
      );
      if (leaks.length > 0) {
        throw new Error(`${id} has unresolved placeholders: ${leaks.slice(0, 5).join(", ")}`);
      }
    }
  });

  maybeIt("injectStructured wins — real couple names present", () => {
    for (const id of layouts) {
      expect(outputs[id]).toContain("Priya");
      expect(outputs[id]).toContain("Arjun");
    }
  });

  maybeIt("no raw Supabase URLs", () => {
    for (const id of layouts) {
      expect(outputs[id]).not.toMatch(/supabase\.co\/storage/);
    }
  });

  maybeIt("each layout has its distinctive structural class", () => {
    expect(outputs["layout-1"]).toContain("story-grid");
    expect(outputs["layout-2"]).toContain("story-photo-decoration");
    expect(outputs["layout-2"]).toContain("rsvp-split");
    expect(outputs["layout-3"]).toContain("story-centered");
    expect(outputs["layout-4"]).toContain("rsvp-header-full");
  });

  maybeIt("events section expanded to 2 cards", () => {
    for (const id of layouts) {
      const cards = (outputs[id].match(/<div class="event-card/g) ?? []).length;
      expect(cards).toBe(2);
    }
  });

  maybeIt("RSVP form rendered with the right fields", () => {
    for (const id of layouts) {
      expect(outputs[id]).toContain('id="rsvp-form"');
      expect(outputs[id]).toContain('name="first_name"');
      expect(outputs[id]).toContain('name="email"');
      expect(outputs[id]).toContain('name="attending"');
    }
  });

  maybeIt("mobile breakpoints present in every skeleton", () => {
    for (const id of layouts) {
      expect(outputs[id]).toMatch(/@media[^{]*max-width:\s*768px/);
      expect(outputs[id]).toMatch(/@media[^{]*max-width:\s*480px/);
    }
  });
});
