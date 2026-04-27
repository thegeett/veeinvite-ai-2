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
import { runPalettePreCall } from "@/lib/ai/prePaletteCall";
import { buildMergedCulturalProfile } from "@/lib/cultural/library";
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

  // 1. Cultural profile (merged across all selections — interfaith couples).
  const culturalProfile: CulturalProfile | null = buildMergedCulturalProfile(
    quizAnswers.cultures ?? [],
    quizAnswers.contentValues ?? {}
  );

  // 2. Layout.
  const layoutDecision = selectLayout({
    styleCard: quizAnswers.styleCard,
    culturalProfile,
    isStep1: !quizAnswers.styleCard
  });
  const layoutId = layoutDecision.layoutId;

  // 3. Skeleton.
  const skeletonHtml = readSkeleton(layoutId);

  // 4. Tags for AI context. PALETTE-01 renamed `vibeWords` (free-text words)
  // to `vibeTags` (structured tag ids from the picker). The shape is the same
  // — string[] — and `tagsFromQuiz` performs keyword matches against
  // VIBE_TAG_MAP that work for both.
  const tags = tagsFromQuiz({
    styleCard: quizAnswers.styleCard,
    vibeWords: quizAnswers.vibeTags,
    cultureId: culturalProfile?.id
  });

  // 5. Pre-call (PALETTE-03) — Haiku picks the 4 expressive tokens that
  // both Call 2 and Call 3 will inherit. Tests can skip this with
  // `paletteOverride`; production always runs the pre-call (Haiku is fast
  // and cheap; the architectural goal is sourcing creative decisions
  // upstream, not memoising them).
  const palette =
    input.paletteOverride ??
    (await runPalettePreCall({
      cultureId: culturalProfile?.id ?? "western",
      subRegion: culturalProfile?.subRegion,
      styleCard: quizAnswers.styleCard ?? "",
      vibeTags: quizAnswers.vibeTags ?? [],
      cultureName: culturalProfile?.displayName ?? "Western"
    }));

  // 6. Call 2 + Call 3 in PARALLEL against the locked palette. The latency
  // win (~7s) and the failure-isolation win both come from this Promise.all
  // — see `doc/precall_palette_architecture.md`. Each call independently
  // honours the 4 pre-call tokens; Call 2 produces the remaining 8 design
  // tokens around them.
  const call2Couple = {
    person1_name: couple.person1_name,
    person2_name: couple.person2_name,
    wedding_date: couple.wedding_date,
    venue_name: couple.venue_name,
    venue_city: couple.venue_city,
    style: couple.style,
    vibe: couple.vibe,
    story: couple.story,
    cultural_context: couple.cultural_context
  };
  const call3Couple = {
    person1_name: couple.person1_name,
    person2_name: couple.person2_name,
    wedding_date: couple.wedding_date,
    venue_name: couple.venue_name,
    venue_city: couple.venue_city,
    style: couple.style,
    vibe: couple.vibe,
    story: couple.story
  };

  const [themeJson, heroHtml] = await Promise.all([
    input.themeOverride
      ? Promise.resolve(input.themeOverride)
      : runCall2({
          skeletonHtml,
          layoutId,
          couple: call2Couple,
          culturalProfile,
          tags,
          palette
        }),
    input.heroOverride
      ? Promise.resolve(input.heroOverride)
      : runCall3({
          palette,
          couple: call3Couple,
          culturalProfile
        })
  ]);

  // 7. Validate Call 2's output and apply safe defaults. Critically: the
  // 4 pre-call tokens MUST appear unchanged in the returned globalTokens.
  // If Call 2 drifted (e.g. ignored the lock), the pre-call's values win —
  // we overwrite Call 2's versions of the 4 with the locked palette.
  //
  // Drift is logged (not thrown) so observability can spot prompt-honouring
  // regressions without impacting the user-facing render. Hard rejection
  // would route to the Call 2 fallback path, losing the (still-good) other
  // 8 tokens — overwrite-and-warn is a strictly better fix.
  for (const key of ["bgPrimary", "accent", "gold", "fontDisplay"] as const) {
    const returned = themeJson.globalTokens[key];
    const locked = palette[key];
    if (returned !== locked) {
      console.warn(
        `[pipeline] Call 2 drifted on locked token ${key}: returned ${returned}, expected ${locked}. Overwriting with pre-call value.`
      );
    }
  }

  const validated = validateAll(themeJson);
  const validatedTheme: ThemeJSON = {
    globalTokens: {
      ...themeJson.globalTokens,
      // Lock the 4 expressive tokens to the pre-call result.
      bgPrimary: palette.bgPrimary,
      accent: palette.accent,
      gold: palette.gold,
      fontDisplay: palette.fontDisplay
    },
    styles: validated.styles,
    fonts: validated.fonts,
    particles: validated.particles,
    content: validated.content,
    designSummary: themeJson.designSummary,
    reasoning: themeJson.reasoning
  };

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
    culturalProfile,
    expressivePalette: palette
  };
}
