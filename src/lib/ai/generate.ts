// STUB — replaced by Stream B in Phase 4.
// Wraps Anthropic SDK. Never called from the browser (architecture rule 10).
// Models: claude-sonnet-4-5 for Calls 2/3, claude-haiku-4-5-20251001 for classifier.

import type {
  Call2Input,
  Call3Input,
  ClassifierInput,
  ThemeJSON,
  AIEditClassification
} from "@/lib/types";

const stubTokens = {
  bgPrimary: "#0E0A0F",
  bgSecondary: "#1A0F1E",
  bgCard: "rgba(255,255,255,0.02)",
  accent: "#C4607A",
  accentLight: "#E8A0B0",
  gold: "#D4A853",
  textPrimary: "rgba(253,246,238,0.9)",
  textMuted: "rgba(253,246,238,0.5)",
  textSubtle: "rgba(253,246,238,0.3)",
  fontDisplay: "Great Vibes",
  fontHeading: "Cormorant Garamond",
  fontBody: "Jost"
};

export async function runCall2(_input: Call2Input): Promise<ThemeJSON> {
  return {
    globalTokens: stubTokens,
    styles: {},
    fonts: ["Great Vibes", "Cormorant Garamond", "Jost"],
    particles: { effect: "none", colors: [], count: 0, opacity: 0 },
    content: {},
    designSummary: "Stub theme — Stream B replaces.",
    reasoning: {}
  };
}

export async function runCall3(_input: Call3Input): Promise<string> {
  return "<section class=\"hero\"><h1>Stub hero</h1></section>";
}

export async function runClassifier(_input: ClassifierInput): Promise<AIEditClassification> {
  return { type: "design", confidence: 0 };
}
