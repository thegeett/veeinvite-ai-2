// Vibe word → tag dictionary — plan §27.
//
// Tags are vibe context only. They no longer drive layout selection (§25).
// They're injected into Call 2 and Call 3 prompts so the AI has a handle on
// the couple's aesthetic intent beyond the style card label.

import type { StyleCard } from "@/lib/types";

export const VIBE_TAG_MAP: Record<string, string[]> = {
  romantic: ["romantic", "warm", "traditional", "elegant"],
  intimate: ["romantic", "intimate", "warm"],
  grand: ["grand", "ornate", "luxury", "celebratory"],
  lavish: ["luxury", "grand", "ornate"],
  luxurious: ["luxury", "grand", "elegant"],
  festive: ["celebratory", "grand", "warm"],
  vibrant: ["celebratory", "bold", "warm"],
  modern: ["modern", "clean", "contemporary", "minimal"],
  clean: ["clean", "minimal", "modern", "airy"],
  minimal: ["minimal", "clean", "modern", "airy"],
  simple: ["simple", "clean", "minimal", "airy"],
  sleek: ["modern", "clean", "contemporary", "editorial"],
  bold: ["bold", "editorial", "dramatic", "contemporary"],
  dramatic: ["dramatic", "editorial", "bold", "destination"],
  elegant: ["elegant", "traditional", "classic", "soft"],
  classic: ["classic", "traditional", "elegant"],
  timeless: ["classic", "traditional", "elegant"],
  natural: ["natural", "bohemian", "earthy", "organic"],
  rustic: ["earthy", "natural", "bohemian", "organic"],
  bohemian: ["bohemian", "natural", "whimsical", "organic"],
  boho: ["bohemian", "natural", "whimsical"],
  whimsical: ["whimsical", "bohemian", "natural", "soft"],
  glamorous: ["destination", "luxury", "dramatic", "bold"],
  destination: ["destination", "dramatic", "luxury", "editorial"],
  cinematic: ["dramatic", "editorial", "bold"],
  desi: ["south-asian", "grand", "indian", "celebratory"],
  indian: ["south-asian", "indian", "grand", "celebratory"],
  tamil: ["south-asian", "south-indian", "traditional"],
  punjabi: ["south-asian", "grand", "celebratory", "vibrant"],
  gujarati: ["south-asian", "traditional", "celebratory"],
  bengali: ["south-asian", "traditional", "refined"],
  muslim: ["devotional", "formal", "elegant"],
  jewish: ["traditional", "intimate", "romantic"],
  chinese: ["bold", "traditional", "refined"],
  nigerian: ["grand", "vibrant", "celebratory"],
  latin: ["romantic", "traditional", "warm"]
};

const STYLE_CARD_TAGS: Record<StyleCard, string[]> = {
  "Modern Minimalist": ["modern", "clean", "minimal", "airy", "contemporary", "western"],
  "Romantic Traditional": ["romantic", "warm", "traditional", "classic", "intimate", "elegant"],
  "Bohemian Garden": ["bohemian", "natural", "earthy", "organic", "garden", "whimsical"],
  "Elegant Minimal": ["minimal", "elegant", "refined", "clean", "soft"],
  "South Asian Grand": [
    "grand",
    "celebratory",
    "ornate",
    "luxury",
    "multi-event",
    "rich",
    "dramatic"
  ],
  "Destination Glamour": ["destination", "dramatic", "luxury", "editorial", "bold"],
  "Editorial Bold": ["editorial", "bold", "asymmetric", "contemporary", "dramatic"]
};

/**
 * Builds the vibe-tag array for the AI prompts. Inputs:
 *   - styleCard: seeds a curated tag list
 *   - vibeWords: 3 words (typed by the couple) — each looked up in VIBE_TAG_MAP
 *   - cultureId: may contribute cultural tags
 *
 * Unknown vibe words are silently ignored. Result is deduplicated, insertion-
 * order preserved.
 */
export function tagsFromQuiz(input: {
  styleCard?: StyleCard;
  vibeWords?: string[];
  cultureId?: string;
}): string[] {
  const out = new Set<string>();
  if (input.styleCard) {
    for (const t of STYLE_CARD_TAGS[input.styleCard] ?? []) out.add(t);
  }
  if (input.cultureId) {
    const cultureTag = input.cultureId.toLowerCase();
    // Map common culture ids to tag seed words in VIBE_TAG_MAP.
    const seedKey = cultureTag.includes("hindu")
      ? "indian"
      : cultureTag.includes("muslim")
        ? "muslim"
        : cultureTag.includes("jewish")
          ? "jewish"
          : cultureTag.includes("chinese")
            ? "chinese"
            : cultureTag.includes("nigerian")
              ? "nigerian"
              : cultureTag.includes("latin")
                ? "latin"
                : undefined;
    if (seedKey) {
      for (const t of VIBE_TAG_MAP[seedKey] ?? []) out.add(t);
    }
  }
  for (const w of input.vibeWords ?? []) {
    const normalised = w?.trim()?.toLowerCase();
    if (!normalised) continue;
    const tags = VIBE_TAG_MAP[normalised];
    if (!tags) continue;
    for (const t of tags) out.add(t);
  }
  return Array.from(out);
}
