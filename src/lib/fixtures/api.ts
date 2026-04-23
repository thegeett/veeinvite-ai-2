// Fixture-first API helpers for Stream A while Stream C's routes are stubs.
// Feature code imports these via the USE_FIXTURES gate:
//
//   const data = process.env.NODE_ENV === "development" && USE_FIXTURES
//     ? fixtures.generateSite(input)
//     : await fetch("/api/generate", { method: "POST", body: JSON.stringify(input) }).then(r => r.json());
//
// When Stream C merges real routes, replace fixture call sites with fetch().

import type {
  ChatEditInput,
  CoupleData,
  CulturalProfile,
  GenerateSiteOutput,
  QuizStep1Answers,
  QuizStep2Answers,
  SiteVersion
} from "@/lib/types";

export const USE_FIXTURES = true;

const FAKE_SLUG = "priya-and-arjun";
const FAKE_COUPLE_ID = "fixture-couple-00000000";

export async function generateSite(
  quizAnswers: QuizStep1Answers
): Promise<{ coupleId: string; slug: string; output: Partial<GenerateSiteOutput> }> {
  await sleep(600);
  return {
    coupleId: FAKE_COUPLE_ID,
    slug: quizAnswers.person1_name && quizAnswers.person2_name
      ? slugify(`${quizAnswers.person1_name}-and-${quizAnswers.person2_name}`)
      : FAKE_SLUG,
    output: {
      layoutId: "layout-1",
      designSummary:
        "Warm editorial minimalism — ivory canvas, muted accents, generous whitespace."
    }
  };
}

export async function editSite(input: ChatEditInput): Promise<{ ok: true; appliedAt: string }> {
  await sleep(350);
  return { ok: true, appliedAt: new Date().toISOString() };
}

export async function loadCouple(): Promise<Partial<CoupleData>> {
  await sleep(200);
  return {
    id: FAKE_COUPLE_ID,
    slug: FAKE_SLUG,
    person1_name: "Priya",
    person2_name: "Arjun",
    wedding_date: "14 November 2026",
    wedding_date_iso: "2026-11-14",
    venue_name: "The Leela Palace",
    venue_city: "Udaipur",
    rsvp_deadline: "2026-10-14",
    style: "grand",
    vibe: "intimate, celebratory, warm",
    story: "",
    cultural_context: "hindu_indian/tamil",
    layout_id: "layout-3",
    cultural_profile: null,
    photo_urls: [],
    custom_sections: [],
    is_published: false
  };
}

export async function loadVersions(coupleId: string): Promise<SiteVersion[]> {
  await sleep(150);
  const now = Date.now();
  const day = 86_400_000;
  return [
    mockVersion(coupleId, 3, now, "Softened the palette for a quieter feel", "Restored after honeymoon colours"),
    mockVersion(coupleId, 2, now - day, "More dramatic hero typography", null),
    mockVersion(coupleId, 1, now - 2 * day, "Initial design", null)
  ];
}

export async function loadRSVPs(coupleId: string) {
  await sleep(200);
  return [
    {
      id: "r1",
      couple_id: coupleId,
      first_name: "Anjali",
      last_name: "Mehta",
      email: "anjali@example.com",
      attending: true,
      guest_count: 4,
      children_count: 2,
      plus_one_name: null,
      events_attending: ["mehendi", "saptapadi", "reception"],
      meal_choice: "vegetarian",
      dietary: "jain-friendly please",
      song_request: "Bollywood classics",
      message: "So excited for you both!",
      created_at: new Date(Date.now() - 86_400_000 * 2).toISOString()
    },
    {
      id: "r2",
      couple_id: coupleId,
      first_name: "Rohan",
      last_name: "Desai",
      email: "rohan@example.com",
      attending: true,
      guest_count: 2,
      children_count: 0,
      plus_one_name: "Kiara",
      events_attending: ["saptapadi", "reception"],
      meal_choice: null,
      dietary: null,
      song_request: null,
      message: null,
      created_at: new Date(Date.now() - 86_400_000).toISOString()
    },
    {
      id: "r3",
      couple_id: coupleId,
      first_name: "Meera",
      last_name: "Khan",
      email: "meera@example.com",
      attending: false,
      guest_count: 0,
      children_count: 0,
      plus_one_name: null,
      events_attending: [],
      meal_choice: null,
      dietary: null,
      song_request: null,
      message: "Wish I could be there — sending love.",
      created_at: new Date().toISOString()
    }
  ];
}

function mockVersion(
  coupleId: string,
  versionNumber: number,
  createdAtMs: number,
  instruction: string,
  label: string | null
): SiteVersion {
  return {
    id: `ver-${versionNumber}`,
    couple_id: coupleId,
    version_number: versionNumber,
    layout_id: "layout-3",
    hero_html: null,
    global_tokens: null,
    theme_json: {
      globalTokens: {
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
      },
      styles: {},
      fonts: [],
      particles: { effect: "none", colors: [], count: 0, opacity: 0 },
      content: {},
      designSummary: instruction
    },
    design_summary: instruction,
    instruction,
    label,
    created_at: new Date(createdAtMs).toISOString()
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type { CulturalProfile, QuizStep1Answers, QuizStep2Answers };
