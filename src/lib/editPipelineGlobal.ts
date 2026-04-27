// Global-edit pipeline — extracted from /api/edit so it can be unit-tested
// without mocking Supabase.
//
// AC #11 of PALETTE-03: a "global" / "start fresh" edit must rerun the
// Haiku pre-call (producing a NEW expressive palette) and then Calls 2 + 3
// against that fresh palette. Design and hero edits, in contrast, reuse
// the persisted `expressive_palette` via `deriveEditPalette()`.
//
// The fresh palette returned here must be persisted to `couples` by the
// caller — otherwise subsequent design / hero edits would still reference
// the old palette via `couple.expressive_palette`. The route handles that.

import type {
  CoupleData,
  ExpressivePalette,
  LayoutId,
  ThemeJSON
} from "@/lib/types";
import { runCall2, runCall3 } from "@/lib/ai/generate";
import { runPalettePreCall } from "@/lib/ai/prePaletteCall";

export interface GlobalEditInput {
  couple: CoupleData;
  layoutId: LayoutId;
  skeletonHtml: string;
}

export interface GlobalEditOutput {
  themeJson: ThemeJSON;
  heroHtml: string;
  /** The freshly chosen 4 expressive tokens. Caller must persist these. */
  palette: ExpressivePalette;
}

export async function runGlobalEditPipeline(
  input: GlobalEditInput
): Promise<GlobalEditOutput> {
  const profile = input.couple.cultural_profile;

  const palette = await runPalettePreCall({
    cultureId: profile?.id ?? "western",
    subRegion: profile?.subRegion,
    styleCard: input.couple.style ?? "",
    vibeTags: input.couple.vibe_tags ?? [],
    cultureName: profile?.displayName ?? "Western"
  });

  const [themeJson, heroHtml] = await Promise.all([
    runCall2({
      skeletonHtml: input.skeletonHtml,
      layoutId: input.layoutId,
      couple: input.couple,
      culturalProfile: profile,
      tags: [],
      palette
    }),
    runCall3({
      palette,
      couple: input.couple,
      culturalProfile: profile
    })
  ]);

  // Lock the 4 fresh tokens into globalTokens (matches main pipeline's
  // overwrite-and-warn invariant — see DECISIONS [2026-04] for why we
  // overwrite rather than reject Call 2 drift).
  const lockedTheme: ThemeJSON = {
    ...themeJson,
    globalTokens: {
      ...themeJson.globalTokens,
      bgPrimary: palette.bgPrimary,
      accent: palette.accent,
      gold: palette.gold,
      fontDisplay: palette.fontDisplay
    }
  };

  return { themeJson: lockedTheme, heroHtml, palette };
}
