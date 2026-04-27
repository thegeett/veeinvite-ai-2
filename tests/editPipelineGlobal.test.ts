// F4 — global edit pipeline must rerun the pre-call.
//
// AC #11 of PALETTE-03: a "start fresh, totally different style" instruction
// reruns the pre-call AND Calls 2 + 3 (rather than reusing the persisted
// expressive_palette). This test asserts that contract against a pure
// helper (`runGlobalEditPipeline`) extracted from `/api/edit/route.ts`.
//
// Test runs before the helper exists; it will fail with a missing-module
// error until F4 is implemented.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runGlobalEditPipeline } from "@/lib/editPipelineGlobal";
import { __setClientForTesting } from "@/lib/ai/generate";
import type { CoupleData } from "@/lib/types";

// A Punjabi couple with a known persisted palette. The fresh pre-call
// should NOT return this palette — it should pick something new from the
// Punjabi range. Test asserts the returned palette is from the Punjabi
// HSL band, not the persisted neutral one.
const PERSISTED_PALETTE = {
  bgPrimary: "hsl(0, 0%, 96%)", // neutral — definitely not Punjabi
  accent: "hsl(0, 0%, 20%)",
  gold: "hsl(40, 50%, 50%)",
  fontDisplay: "Cormorant Garamond"
};

function makeCouple(): CoupleData {
  return {
    id: "c-edit",
    user_id: "u",
    slug: "test-couple",
    person1_name: "Meera",
    person2_name: "Arjun",
    wedding_date: "14 November 2025",
    wedding_date_iso: "2025-11-14T00:00:00Z",
    venue_name: "Rambagh Palace",
    venue_city: "Jaipur",
    rsvp_deadline: null,
    style: "South Asian Grand",
    vibe: "grand",
    story: null,
    cultural_context: "hindu_indian",
    cultures: [
      {
        cultureId: "hindu_indian",
        subRegion: "punjabi",
        confirmedContentItemIds: [],
        confirmedCeremonyIds: []
      }
    ],
    vibe_tags: ["grand"],
    expressive_palette: PERSISTED_PALETTE,
    layout_id: "layout-3",
    cultural_profile: {
      id: "hindu_indian",
      subRegion: "punjabi",
      displayName: "Hindu — Punjabi",
      contentItems: [],
      ceremonies: [],
      designGuidance: "",
      copyTone: "",
      copyGuardrails: "",
      bilingualEnabled: false
    },
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
}

// Stub Haiku client returning a fresh Punjabi palette + Sonnet returning
// a complete theme/hero envelope.
function makeStubClient() {
  const fresh = {
    bgPrimary: "hsl(348, 96%, 14%)",
    accent: "hsl(338, 72%, 50%)",
    gold: "hsl(42, 96%, 52%)",
    fontDisplay: "Great Vibes"
  };
  const theme = {
    globalTokens: {
      bgPrimary: fresh.bgPrimary,
      bgSecondary: "#1A0F1E",
      bgCard: "rgba(255,255,255,0.02)",
      accent: fresh.accent,
      accentLight: "#E8A0B0",
      gold: fresh.gold,
      textPrimary: "rgba(253,246,238,0.9)",
      textMuted: "rgba(253,246,238,0.5)",
      textSubtle: "rgba(253,246,238,0.3)",
      fontDisplay: fresh.fontDisplay,
      fontHeading: "Cormorant Garamond",
      fontBody: "Jost"
    },
    styles: {},
    fonts: ["Great Vibes"],
    particles: { effect: "none", colors: [], count: 0, opacity: 0 },
    content: {},
    designSummary: "Punjabi grand"
  };
  const hero = {
    html: "<div class='hero'>{{PERSON1_NAME}} & {{PERSON2_NAME}}</div>",
    style: ".hero{background:#000;}",
    script: ""
  };
  // Haiku precall first, then Call 2 (theme), then Call 3 (hero).
  const responses = [
    JSON.stringify(fresh),
    JSON.stringify(theme),
    JSON.stringify(hero)
  ];
  let i = 0;
  return {
    fresh,
    client: {
      messages: {
        create: vi.fn(async () => {
          const text = responses[i++] ?? responses[responses.length - 1];
          return { content: [{ type: "text", text }] };
        })
      }
    }
  };
}

describe("runGlobalEditPipeline (F4 / AC #11)", () => {
  beforeEach(() => {
    __setClientForTesting(null);
  });
  afterEach(() => {
    __setClientForTesting(null);
  });

  it("runs the pre-call, then Calls 2 + 3 — returns a FRESH palette, not the persisted one", async () => {
    const stub = makeStubClient();
    __setClientForTesting(stub.client as unknown as never);

    const out = await runGlobalEditPipeline({
      couple: makeCouple(),
      layoutId: "layout-3",
      skeletonHtml: "<div data-skeleton></div>"
    });

    // The fresh palette must NOT equal the persisted one — proves the
    // pre-call ran and produced a new selection.
    expect(out.palette.bgPrimary).not.toBe(PERSISTED_PALETTE.bgPrimary);
    expect(out.palette.bgPrimary).toBe(stub.fresh.bgPrimary);

    // The returned theme must lock the fresh palette into globalTokens.
    expect(out.themeJson.globalTokens.bgPrimary).toBe(stub.fresh.bgPrimary);
    expect(out.themeJson.globalTokens.accent).toBe(stub.fresh.accent);
    expect(out.themeJson.globalTokens.gold).toBe(stub.fresh.gold);
    expect(out.themeJson.globalTokens.fontDisplay).toBe(stub.fresh.fontDisplay);

    // Hero CSS came back through Call 3.
    expect(out.heroHtml).toContain("hero");

    // Three Anthropic calls fired: pre-call (Haiku), Call 2 (Sonnet),
    // Call 3 (Sonnet).
    expect(stub.client.messages.create).toHaveBeenCalledTimes(3);
  });
});
