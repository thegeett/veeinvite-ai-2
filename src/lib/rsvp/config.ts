// STUB — replaced by Stream B.
// See plan §29 for smart defaults per cultural profile.
// buildRSVPForm returns the HTML fragment that replaces {{RSVP_FORM}} in skeletons.

import type { CulturalProfile, RSVPConfig, EventData } from "@/lib/types";

export function smartDefaultsForProfile(profile: CulturalProfile | null): RSVPConfig {
  // Stream B implements the per-culture defaults from §29 table.
  return {
    guestCountEnabled: true,
    guestCountMax: profile?.id.startsWith("hindu") ? 10 : 4,
    childrenSeparate: false,
    childrenMax: 5,
    plusOneEnabled: false,
    eventSelectionEnabled: false,
    mealChoiceEnabled: false,
    mealOptions: [],
    dietaryEnabled: true,
    messageEnabled: true,
    songRequestEnabled: false
  };
}

export function buildRSVPForm(_config: RSVPConfig, _events: EventData[]): string {
  return "<!-- Stub RSVP form — Stream B replaces with data-driven form per §29 -->";
}
