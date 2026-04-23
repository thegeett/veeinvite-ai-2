// STUB — replaced by Stream B.
// The pipeline orchestrator: quiz answers → full rendered HTML.
// Stream C's /api/generate calls this function. See plan §4.

import type { GenerateSiteInput, GenerateSiteOutput } from "@/lib/types";

export async function generateSite(_input: GenerateSiteInput): Promise<GenerateSiteOutput> {
  // Stream B sequences: culturalProfile build → layout select → Call 2 → validate
  //                    → Call 3 → render → return bundle.
  return {
    html: "<!DOCTYPE html><html><body>Stub site</body></html>",
    themeJson: {
      globalTokens: {
        bgPrimary: "#0E0A0F", bgSecondary: "#1A0F1E", bgCard: "rgba(255,255,255,0.02)",
        accent: "#C4607A", accentLight: "#E8A0B0", gold: "#D4A853",
        textPrimary: "rgba(253,246,238,0.9)", textMuted: "rgba(253,246,238,0.5)",
        textSubtle: "rgba(253,246,238,0.3)",
        fontDisplay: "Great Vibes", fontHeading: "Cormorant Garamond", fontBody: "Jost"
      },
      styles: {},
      fonts: [],
      particles: { effect: "none", colors: [], count: 0, opacity: 0 },
      content: {},
      designSummary: "Stub"
    },
    heroHtml: "<section class=\"hero\"><h1>Stub</h1></section>",
    layoutId: "layout-1",
    globalTokens: {
      bgPrimary: "#0E0A0F", bgSecondary: "#1A0F1E", bgCard: "rgba(255,255,255,0.02)",
      accent: "#C4607A", accentLight: "#E8A0B0", gold: "#D4A853",
      textPrimary: "rgba(253,246,238,0.9)", textMuted: "rgba(253,246,238,0.5)",
      textSubtle: "rgba(253,246,238,0.3)",
      fontDisplay: "Great Vibes", fontHeading: "Cormorant Garamond", fontBody: "Jost"
    },
    designSummary: "Stub",
    culturalProfile: null
  };
}
