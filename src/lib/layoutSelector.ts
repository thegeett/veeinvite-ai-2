// Layout selection — plan §25.
//
// Deterministic. No AI call in v1.
// Precedence:
//   1. Style card, if set → STYLE_CARD_TO_LAYOUT
//   2. Else cultural profile id → CULTURE_TO_SUGGESTED_LAYOUT
//   3. Else → layout-1 (default)
//
// The §6 "ambiguity → Claude confirms" rule from earlier plan revisions is
// deprecated (§25). Tags no longer drive layout selection.

import type { CulturalProfile, LayoutId, StyleCard } from "@/lib/types";
import { CULTURE_TO_SUGGESTED_LAYOUT, STYLE_CARD_TO_LAYOUT } from "@/lib/types";

export interface LayoutSelectionInput {
  styleCard?: StyleCard;
  culturalProfile?: CulturalProfile | null;
  isStep1?: boolean;
}

export interface LayoutSelectionOutput {
  layoutId: LayoutId;
  reason: string;
}

export function selectLayout(input: LayoutSelectionInput): LayoutSelectionOutput {
  if (input.styleCard && STYLE_CARD_TO_LAYOUT[input.styleCard]) {
    return {
      layoutId: STYLE_CARD_TO_LAYOUT[input.styleCard],
      reason: `Style card "${input.styleCard}" (wins over any cultural suggestion per §25)`
    };
  }
  const cultureId = input.culturalProfile?.id;
  if (cultureId && CULTURE_TO_SUGGESTED_LAYOUT[cultureId]) {
    return {
      layoutId: CULTURE_TO_SUGGESTED_LAYOUT[cultureId],
      reason: `Cultural profile "${cultureId}" suggests this layout (§25)`
    };
  }
  return {
    layoutId: "layout-1",
    reason: "Default — no style card, no cultural profile"
  };
}
