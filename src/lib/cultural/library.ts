// STUB — replaced by Stream B.
// Loads and exposes the cultural content library. See plan §26 for algorithms:
//   - getCeremoniesForCouple (default + sub-region overrides + additional)
//   - buildCulturalProfile
//   - buildCulturalPromptBlock
//   - findConflicts (interfaith weddings)

import library from "@/lib/cultural-content-library.json";
import type {
  CulturalContentLibrary,
  CulturalProfile,
  DisplayCeremony,
  CulturalConflict
} from "@/lib/types";

export function loadLibrary(): CulturalContentLibrary {
  return library as unknown as CulturalContentLibrary;
}

export function getCeremoniesForCouple(_cultureId: string, _subRegion?: string): DisplayCeremony[] {
  // Stream B implements the full algorithm per plan §26.
  return [];
}

export function buildCulturalProfile(
  _cultureId: string,
  _subRegion: string | undefined,
  _confirmedContentItemIds: string[],
  _confirmedCeremonyIds: string[],
  _contentValues: Record<string, string>
): CulturalProfile {
  return {
    id: "stub",
    displayName: "Stub",
    contentItems: [],
    ceremonies: [],
    designGuidance: "",
    copyTone: "",
    copyGuardrails: "",
    bilingualEnabled: false
  };
}

export function buildCulturalPromptBlock(_profile: CulturalProfile | null): string {
  return "";
}

export function findConflicts(_profiles: CulturalProfile[]): CulturalConflict[] {
  return [];
}
