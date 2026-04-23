// Pipeline orchestrator — plan §4.
//
// Stream C's /api/generate calls generateSite() to produce the full bundle.
// Pure sequencing only. Supabase I/O belongs to Stream C.
//
// Sequence:
//   1. Build cultural profile from quiz step 2 answers (if present).
//   2. Select layout (style card wins, else culture, else layout-1).
//   3. Load the selected skeleton from layouts/<id>/skeleton.html.
//   4. runCall2 → ThemeJSON.
//   5. validateAll(themeJson) — defensive; the renderer also validates.
//   6. runCall3(globalTokens) → hero HTML.
//   7. render() — uses validated theme, hero, cultural profile, couple, events,
//      rsvp config, custom sections.
//   8. Return bundle for Stream C to persist.

import fs from "node:fs";
import path from "node:path";

import type {
  CulturalProfile,
  GenerateSiteInput,
  GenerateSiteOutput,
  LayoutId,
  ThemeJSON
} from "@/lib/types";
import { runCall2, runCall3 } from "@/lib/ai/generate";
import { buildCulturalProfile } from "@/lib/cultural/library";
import { selectLayout } from "@/lib/layoutSelector";
import { render } from "@/lib/renderer";
import { smartDefaultsForProfile } from "@/lib/rsvp/config";
import { tagsFromQuiz } from "@/lib/tags/vibeMap";
import { validateAll } from "@/lib/validator";

const LAYOUT_DIR: Record<LayoutId, string> = {
  "layout-1": "layout-1-modern",
  "layout-2": "layout-2-romantic",
  "layout-3": "layout-3-grand",
  "layout-4": "layout-4-editorial"
};

function resolveLayoutsRoot(): string {
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, "layouts");
    if (fs.existsSync(candidate)) return candidate;
    // Sibling worktree lookup for dev environments.
    if (fs.existsSync(current)) {
      for (const entry of fs.readdirSync(current)) {
        if (!entry.startsWith("veeinvite-")) continue;
        const sibling = path.join(current, entry, "layouts");
        if (fs.existsSync(sibling)) return sibling;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(process.cwd(), "layouts");
}

function readSkeleton(layoutId: LayoutId): string {
  const root = resolveLayoutsRoot();
  const sub = LAYOUT_DIR[layoutId] ?? LAYOUT_DIR["layout-1"];
  return fs.readFileSync(path.join(root, sub, "skeleton.html"), "utf8");
}

// ---------- Public API ----------------------------------------------------

export async function generateSite(input: GenerateSiteInput): Promise<GenerateSiteOutput> {
  const { quizAnswers, couple } = input;
  const events = input.events ?? [];

  // 1. Cultural profile.
  const culturalProfile: CulturalProfile | null = quizAnswers.cultureId
    ? buildCulturalProfile(
        quizAnswers.cultureId,
        quizAnswers.subRegion,
        quizAnswers.confirmedContentItemIds ?? [],
        quizAnswers.confirmedCeremonyIds ?? [],
        quizAnswers.contentValues ?? {}
      )
    : null;

  // 2. Layout.
  const layoutDecision = selectLayout({
    styleCard: quizAnswers.styleCard,
    culturalProfile,
    isStep1: !quizAnswers.styleCard
  });
  const layoutId = layoutDecision.layoutId;

  // 3. Skeleton.
  const skeletonHtml = readSkeleton(layoutId);

  // 4. Tags for AI context.
  const tags = tagsFromQuiz({
    styleCard: quizAnswers.styleCard,
    vibeWords: quizAnswers.vibeWords,
    cultureId: culturalProfile?.id
  });

  // 5. Call 2 — full-site design tokens.
  const themeJson =
    input.themeOverride ??
    (await runCall2({
      skeletonHtml,
      layoutId,
      couple: {
        person1_name: couple.person1_name,
        person2_name: couple.person2_name,
        wedding_date: couple.wedding_date,
        venue_name: couple.venue_name,
        venue_city: couple.venue_city,
        style: couple.style,
        vibe: couple.vibe,
        story: couple.story,
        cultural_context: couple.cultural_context
      },
      culturalProfile,
      tags
    }));

  // 6. Validate and apply safe defaults.
  const validated = validateAll(themeJson);
  const validatedTheme: ThemeJSON = {
    globalTokens: themeJson.globalTokens,
    styles: validated.styles,
    fonts: validated.fonts,
    particles: validated.particles,
    content: validated.content,
    designSummary: themeJson.designSummary,
    reasoning: themeJson.reasoning
  };

  // 7. Call 3 — hero.
  const heroHtml =
    input.heroOverride ??
    (await runCall3({
      globalTokens: validatedTheme.globalTokens,
      couple: {
        person1_name: couple.person1_name,
        person2_name: couple.person2_name,
        wedding_date: couple.wedding_date,
        venue_name: couple.venue_name,
        venue_city: couple.venue_city,
        style: couple.style,
        vibe: couple.vibe,
        story: couple.story
      },
      culturalProfile
    }));

  // 8. RSVP config — built from cultural profile + event count.
  const rsvpConfig =
    couple.rsvp_config ?? smartDefaultsForProfile(culturalProfile, events.length);

  // 9. Render.
  const html = render(
    {
      layoutId,
      themeJson: validatedTheme,
      heroHtml,
      culturalProfile,
      couple,
      events,
      rsvpConfig,
      customSections: couple.custom_sections ?? []
    },
    { skeletonHtml }
  );

  return {
    html,
    themeJson: validatedTheme,
    heroHtml,
    layoutId,
    globalTokens: validatedTheme.globalTokens,
    designSummary: validatedTheme.designSummary,
    culturalProfile
  };
}
