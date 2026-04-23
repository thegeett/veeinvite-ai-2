// STUB — replaced by Stream B in Phase 3.
// See plan §25 for the decision tree. Style card wins over culture suggestion.

import type { LayoutId, StyleCard, CulturalProfile } from "@/lib/types";
import { STYLE_CARD_TO_LAYOUT } from "@/lib/types";

export interface LayoutSelectionInput {
  styleCard?: StyleCard;
  culturalProfile?: CulturalProfile | null;
  isStep1: boolean;
}

export interface LayoutSelectionOutput {
  layoutId: LayoutId;
  reason: string;
}

export function selectLayout(input: LayoutSelectionInput): LayoutSelectionOutput {
  if (input.styleCard) {
    return {
      layoutId: STYLE_CARD_TO_LAYOUT[input.styleCard],
      reason: `Style card "${input.styleCard}" (wins over any cultural suggestion)`
    };
  }
  if (input.culturalProfile?.id) {
    // Stream B replaces this with full CULTURE_TO_SUGGESTED_LAYOUT table.
    return { layoutId: "layout-1", reason: "Stub — culture-based suggestion" };
  }
  return { layoutId: "layout-1", reason: "Default — no signal" };
}
