// Integration — renders against the real layout-1 skeleton produced by
// Stream A. Skips automatically when running in a worktree that doesn't have
// layouts/ on disk (engine worktree typically won't until main is synced).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@/lib/renderer";
import { smartDefaultsForProfile } from "@/lib/rsvp/config";
import { buildCulturalProfile } from "@/lib/cultural/library";
import type { CoupleData, RenderInput, ThemeJSON } from "@/lib/types";
import { FIXTURE_HERO } from "./fixtures/skeleton";

function findLayoutsRoot(): string | null {
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, "layouts");
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, "layout-1-modern", "skeleton.html"))) {
      return candidate;
    }
    // Check sibling worktrees — Stream A commonly has layouts in ../veeinvite-frontend
    const siblings = fs.existsSync(current) ? fs.readdirSync(current).filter((n) => n.startsWith("veeinvite-")) : [];
    for (const sib of siblings) {
      const sibPath = path.join(current, sib, "layouts", "layout-1-modern", "skeleton.html");
      if (fs.existsSync(sibPath)) return path.join(current, sib, "layouts");
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const layoutsRoot = findLayoutsRoot();

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
    style: null,
    vibe: null,
    story: null,
    cultural_context: null,
    layout_id: "layout-1",
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

const theme: ThemeJSON = {
  globalTokens: BASE_TOKENS,
  styles: {
    body: { background: "#0E0A0F", color: "rgba(253,246,238,0.9)" },
    ".story-eyebrow": { color: "#D4A853", "letter-spacing": "0.2em" }
  },
  fonts: ["Great Vibes", "Cormorant Garamond:400,700", "Jost:400,500"],
  particles: { effect: "none", colors: [], count: 0, opacity: 0 },
  content: {
    TAGLINE: "Written in the stars",
    CTA_LABEL: "RSVP",
    RSVP_ACCEPT_LABEL: "Joyfully accepts",
    RSVP_DECLINE_LABEL: "Regretfully declines",
    RSVP_SUBMIT_LABEL: "Send with Love"
  },
  designSummary: "Midnight garden with rose accents"
};

(layoutsRoot ? describe : describe.skip)(
  `renderer — real skeleton (layouts at ${layoutsRoot})`,
  () => {
    for (const layoutId of ["layout-1", "layout-2", "layout-3", "layout-4"] as const) {
      it(`renders ${layoutId} without leaking placeholders or forbidden props`, () => {
        const input: RenderInput = {
          layoutId,
          themeJson: theme,
          heroHtml: FIXTURE_HERO,
          culturalProfile: buildCulturalProfile(
            "hindu_indian",
            "tamil",
            [],
            ["nischayathartham", "wedding_ceremony", "reception"],
            {}
          ),
          couple: makeCouple(),
          events: [],
          rsvpConfig: smartDefaultsForProfile(null, 0),
          customSections: []
        };
        const sub: Record<string, string> = {
          "layout-1": "layout-1-modern",
          "layout-2": "layout-2-romantic",
          "layout-3": "layout-3-grand",
          "layout-4": "layout-4-editorial"
        };
        const skeletonPath = path.join(layoutsRoot!, sub[layoutId], "skeleton.html");
        if (!fs.existsSync(skeletonPath)) return; // skip layout that hasn't been built yet
        const skeletonHtml = fs.readFileSync(skeletonPath, "utf8");
        const html = render(input, { skeletonHtml });

        // No raw Supabase URLs.
        expect(html).not.toMatch(/supabase\.co\/storage/);
        // No leftover {{...}} placeholders except photo markers.
        const leftover = html.match(/\{\{(?!PHOTO:)[^}]+\}\}/g) ?? [];
        expect(leftover).toEqual([]);
        // Structured values present.
        expect(html).toContain("Meera");
        expect(html).toContain("Arjun");
        expect(html).toContain("Rambagh Palace");
      });
    }
  }
);
