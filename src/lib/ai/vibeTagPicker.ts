// vibeTagPicker — pure logic + tag definitions for the structured vibe picker
// (PALETTE-01). See `doc/VIBE_TAG_PICKER_SPEC.md`.
//
// Two modes:
//   - WESTERN couples: tags select an aesthetic family (palette is chosen).
//   - CULTURAL couples: tags adjust DesignWeight (palette is fixed by culture).
//
// No `parseOptionalText` here — free text was deliberately removed by the spec.

import type { DesignWeight } from "@/lib/types";

// ============================================================================
// Western aesthetic families
// ============================================================================

export type WesternFamilyId =
  | "botanical_garden"
  | "dark_romance"
  | "coastal_destination"
  | "editorial_minimal"
  | "warm_rustic"
  | "french_luxury"
  | "midnight_glamour"
  | "scandinavian_clean";

export const WESTERN_FAMILY_IDS: WesternFamilyId[] = [
  "botanical_garden",
  "dark_romance",
  "coastal_destination",
  "editorial_minimal",
  "warm_rustic",
  "french_luxury",
  "midnight_glamour",
  "scandinavian_clean"
];

// ============================================================================
// Tag definitions
// ============================================================================

export interface WesternTagDefinition {
  id: string;
  label: string;
  families: WesternFamilyId[];
  preview: {
    /** [bgPrimary, accent, gold] hex approximations of this tag's most-likely
     *  family. Illustrative — fixed per tag, does not change with selection. */
    swatches: [string, string, string];
    /** "Soft · Warm · Tender" — three keywords describing the feel. */
    keywords: string;
  };
}

export interface CulturalTagDefinition {
  id: string;
  label: string;
  description: string;
  preview: {
    keywords: string;
    /** 0-5 — how much decoration this tag pushes (driven by `density` +
     *  `motifIntensity`). 0 means no change to decoration, 5 means maximum. */
    decoration: number;
    /** 0-3 — how much continuous animation this tag pushes (driven by
     *  `animationLevel`). Independent of decoration. */
    motion: number;
  };
}

// ============================================================================
// Western tag library — 12 most-distinct (down from 16)
// ============================================================================
// Removed near-synonyms in this revision:
//   Minimal (≈ Modern)   Classic (≈ Elegant)
//   Festive (≈ Glamorous) Organic (≈ Natural)

export const WESTERN_TAGS: WesternTagDefinition[] = [
  {
    id: "romantic",
    label: "Romantic",
    families: ["botanical_garden", "dark_romance"],
    preview: { swatches: ["#F5F0E8", "#C4A0A0", "#C5922A"], keywords: "Soft · Warm · Tender" }
  },
  {
    id: "dramatic",
    label: "Dramatic",
    families: ["dark_romance", "midnight_glamour"],
    preview: { swatches: ["#1A0E1E", "#C4607A", "#D4A853"], keywords: "Bold · Moody · Intense" }
  },
  {
    id: "elegant",
    label: "Elegant",
    families: ["french_luxury", "midnight_glamour"],
    preview: { swatches: ["#F5EEE0", "#7A5830", "#B8860B"], keywords: "Refined · Timeless · Chic" }
  },
  {
    id: "bold",
    label: "Bold",
    families: ["editorial_minimal", "midnight_glamour"],
    preview: { swatches: ["#0A0A0A", "#E63946", "#C0C0C0"], keywords: "Striking · Confident · Strong" }
  },
  {
    id: "natural",
    label: "Natural",
    families: ["botanical_garden", "warm_rustic"],
    preview: { swatches: ["#EDE8DC", "#8B6914", "#C17F4A"], keywords: "Earthy · Organic · Garden" }
  },
  {
    id: "moody",
    label: "Moody",
    families: ["dark_romance"],
    preview: { swatches: ["#1A0818", "#9B4D6B", "#D4A853"], keywords: "Dark · Atmospheric · Rich" }
  },
  {
    id: "modern",
    label: "Modern",
    families: ["editorial_minimal", "scandinavian_clean"],
    preview: { swatches: ["#F8F8F8", "#4A4A5A", "#A89060"], keywords: "Clean · Minimal · Fresh" }
  },
  {
    id: "soft",
    label: "Soft",
    families: ["botanical_garden", "french_luxury"],
    preview: { swatches: ["#FAF5EE", "#D4B0A0", "#C5A050"], keywords: "Gentle · Delicate · Quiet" }
  },
  {
    id: "rustic",
    label: "Rustic",
    families: ["warm_rustic"],
    preview: { swatches: ["#2D1B0E", "#C17F4A", "#D4A853"], keywords: "Warm · Earthy · Barn" }
  },
  {
    id: "coastal",
    label: "Coastal",
    families: ["coastal_destination"],
    preview: { swatches: ["#0E1E2E", "#6AB0B0", "#D4B060"], keywords: "Ocean · Airy · Destination" }
  },
  {
    id: "glamorous",
    label: "Glamorous",
    families: ["midnight_glamour"],
    preview: { swatches: ["#0D0D1A", "#C0C8D8", "#C9A84C"], keywords: "Ballroom · Luxe · Dazzling" }
  },
  {
    id: "intimate",
    label: "Intimate",
    families: ["botanical_garden", "french_luxury"],
    preview: { swatches: ["#F5EEE0", "#B09080", "#B8A060"], keywords: "Personal · Warm · Close" }
  }
];

/** Map tag id → list of families that tag points at. Used by the scoring
 *  algorithm to pick a winner. Derived from WESTERN_TAGS for single-source-
 *  of-truth, but exported separately because other code paths only need
 *  the mapping (not the visual previews). */
export const WESTERN_TAG_MAP: Record<string, WesternFamilyId[]> = Object.fromEntries(
  WESTERN_TAGS.map((t) => [t.id, t.families])
);

// ============================================================================
// Cultural tag library — 8 tags, decoration / motion split
// ============================================================================

export const CULTURAL_TAGS: CulturalTagDefinition[] = [
  {
    id: "grand",
    label: "Grand",
    description: "Rich ornamentation, prominent motifs, full celebration energy",
    preview: { keywords: "Ornate · Abundant · Ceremonial", decoration: 5, motion: 3 }
  },
  {
    id: "intimate",
    label: "Intimate",
    description: "Subtle, refined, personal — less ornament, more breathing room",
    preview: { keywords: "Subtle · Personal · Quiet", decoration: 1, motion: 1 }
  },
  {
    id: "traditional",
    label: "Traditional",
    description: "Full cultural expression — motifs, materials, and animation as expected",
    preview: { keywords: "Classic · Ceremonial · Rooted", decoration: 3, motion: 0 }
  },
  {
    id: "contemporary",
    label: "Contemporary",
    description: "Cultural palette, modern visual weight — clean surfaces, subtle motifs",
    preview: { keywords: "Modern · Clean · Minimal", decoration: 1, motion: 0 }
  },
  {
    id: "festive",
    label: "Festive",
    description: "Maximum energy — ambient animation, particles, bold motif",
    preview: { keywords: "Vibrant · Energetic · Celebratory", decoration: 5, motion: 3 }
  },
  {
    id: "elegant",
    label: "Elegant",
    description: "Balanced decoration, silk surface, composed feel",
    preview: { keywords: "Refined · Composed · Balanced", decoration: 3, motion: 0 }
  },
  {
    id: "vibrant",
    label: "Vibrant",
    description: "Full ambient animation — the invitation feels alive and moving",
    // CORRECTED FROM PRIOR VERSION: vibrant now affects ONLY animation, not
    // decoration. Vibrancy = energy/movement, not quantity of ornament.
    // Decoration bar stays empty in the preview.
    preview: { keywords: "Animated · Lively · Moving", decoration: 0, motion: 3 }
  },
  {
    id: "refined",
    label: "Refined",
    description: "Restrained and polished — marble surface, subtle motif, still",
    preview: { keywords: "Polished · Still · Understated", decoration: 1, motion: 0 }
  }
];

/** Map tag id → partial DesignWeight adjustment. Multiple tags compose
 *  left-to-right; later tags overwrite earlier ones on conflicting fields.
 *
 *  IMPORTANT: `vibrant` adjusts ONLY `animationLevel`. It does not push
 *  density or motifIntensity. This is the behaviour test in
 *  `tests/vibeTagPicker.test.ts` pins down. */
export const CULTURAL_TAG_MAP: Record<string, Partial<DesignWeight>> = {
  grand: { density: "ornate", motifIntensity: "prominent", animationLevel: "ambient" },
  intimate: { density: "minimal", motifIntensity: "subtle", animationLevel: "gentle" },
  traditional: { density: "balanced", motifIntensity: "medium", materialType: "velvet" },
  contemporary: { density: "minimal", motifIntensity: "subtle", materialType: "marble" },
  festive: { density: "ornate", motifIntensity: "prominent", animationLevel: "ambient" },
  elegant: { density: "balanced", motifIntensity: "medium", materialType: "silk" },
  vibrant: { animationLevel: "ambient" },
  refined: { density: "minimal", motifIntensity: "subtle", materialType: "marble" }
};

// ============================================================================
// Western family selection — scoring + style-card tie-break
// ============================================================================

const STYLE_CARD_TO_FAMILY: Record<string, WesternFamilyId> = {
  modern_minimalist: "scandinavian_clean",
  elegant_minimal: "french_luxury",
  romantic_traditional: "botanical_garden",
  bohemian_garden: "botanical_garden",
  destination_glamour: "midnight_glamour",
  editorial_bold: "editorial_minimal",
  grand_celebration: "midnight_glamour"
};

function styleCardToFamily(styleCard: string): WesternFamilyId {
  return STYLE_CARD_TO_FAMILY[styleCard] ?? "botanical_garden";
}

function styleCardTieBreak(
  styleCard: string,
  tied: WesternFamilyId[]
): WesternFamilyId {
  const preferred = STYLE_CARD_TO_FAMILY[styleCard];
  return preferred && tied.includes(preferred) ? preferred : tied[0];
}

/**
 * Picks a western aesthetic family from the couple's selected tags.
 * - No tags selected → fall back to the style card.
 * - Tags selected but none match WESTERN_TAG_MAP → fall back to the style card.
 * - Tags match → score each family by how many tags point at it; the
 *   highest-scored family wins. Ties are broken by the style card's
 *   preferred family.
 */
export function selectWesternFamily(
  styleCard: string,
  vibeTags: string[]
): WesternFamilyId {
  if (vibeTags.length === 0) return styleCardToFamily(styleCard);

  const scores: Record<WesternFamilyId, number> = {
    botanical_garden: 0,
    dark_romance: 0,
    coastal_destination: 0,
    editorial_minimal: 0,
    warm_rustic: 0,
    french_luxury: 0,
    midnight_glamour: 0,
    scandinavian_clean: 0
  };

  for (const tag of vibeTags) {
    const families = WESTERN_TAG_MAP[tag.toLowerCase()];
    if (!families) continue;
    for (const f of families) scores[f]++;
  }

  const sorted = (Object.entries(scores) as [WesternFamilyId, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const topScore = sorted[0][1];
  if (topScore === 0) return styleCardToFamily(styleCard);

  const tied = sorted.filter(([, s]) => s === topScore).map(([f]) => f);
  return tied.length === 1 ? tied[0] : styleCardTieBreak(styleCard, tied);
}

// ============================================================================
// DesignWeight composition — for cultural couples
// ============================================================================

/**
 * Applies the tag-driven adjustments from CULTURAL_TAG_MAP onto a base
 * DesignWeight. Tags compose left-to-right: later tags overwrite earlier
 * tags on the same field. Unknown tags are silently ignored (no throw,
 * no fallback) so unmatched input never breaks the pipeline.
 */
export function applyVibeTagsToWeight(
  base: DesignWeight,
  tags: string[]
): DesignWeight {
  let weight: DesignWeight = { ...base };
  for (const tag of tags) {
    const adjustment = CULTURAL_TAG_MAP[tag.toLowerCase()];
    if (adjustment) weight = { ...weight, ...adjustment };
  }
  return weight;
}
