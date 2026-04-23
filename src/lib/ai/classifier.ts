// Classifier — §12 and §30 routing.
//
// A single Haiku call produces an AIEditClassification. This module re-exports
// the runner (it lives in generate.ts) and adds deterministic helpers Stream C
// can use before/after the AI call:
//   - detectDataField: best-effort regex match so a "change our names to X"
//     instruction can be routed to /api/structured without the round-trip.
//   - keywordFastPath: cheap hints the caller can use to skip the Haiku call
//     when confidence is overwhelming (useful for cost control on M2).

import type { AIEditClassification, ClassifierInput, EditType } from "@/lib/types";

export { runClassifier } from "./generate";
export { buildClassifierPrompt } from "./prompt";

export type CoupleDataField =
  | "person1_name"
  | "person2_name"
  | "wedding_date"
  | "venue_name"
  | "venue_city"
  | "rsvp_deadline";

// Check venue_name BEFORE wedding_date so that "update the venue" doesn't
// accidentally match `date` as a substring of `update`.
const DATA_FIELD_PATTERNS: Array<{ field: CoupleDataField; rx: RegExp }> = [
  { field: "rsvp_deadline", rx: /\b(rsvp\s+deadline|rsvp\s+cutoff|rsvp\s+by)\b/i },
  { field: "venue_name", rx: /\b(venue|ceremony location|wedding location)\b/i },
  { field: "venue_city", rx: /\b(city|town|location\s+city)\b/i },
  {
    field: "wedding_date",
    rx: /\b(wedding\s+date|wedding\s+day|the\s+date|move\s+the\s+wedding|push\s+the\s+date)\b/i
  },
  // "our names" is plural — map to person1_name as a representative so the
  // caller (Stream C's /api/structured route) can update both.
  { field: "person1_name", rx: /\b(our\s+names?|bride|person\s*1|first\s+partner)\b/i },
  { field: "person2_name", rx: /\b(groom|person\s*2|second\s+partner)\b/i }
];

export function detectDataField(instruction: string): CoupleDataField | undefined {
  if (!instruction) return undefined;
  if (/\b(change|update|rename|set|correct|fix|move|push)\b/i.test(instruction)) {
    for (const { field, rx } of DATA_FIELD_PATTERNS) {
      if (rx.test(instruction)) return field;
    }
  }
  return undefined;
}

/**
 * Very conservative keyword fast-path. Only returns a classification when the
 * instruction is unambiguous — e.g. "start fresh" → global. Returns undefined
 * when the Haiku call is still required.
 */
export function keywordFastPath(
  input: ClassifierInput
): AIEditClassification | undefined {
  const text = input.instruction.toLowerCase();
  if (!text.trim()) return undefined;
  if (/start fresh|start over|redesign (everything|the whole site)/.test(text)) {
    return { type: "global", confidence: 0.95, reason: "keyword: start fresh / redesign" };
  }
  if (/add a section about|create a new section|add a new page for/.test(text)) {
    return { type: "new_section", confidence: 0.9, reason: "keyword: add a section" };
  }
  const field = detectDataField(input.instruction);
  if (field) {
    return {
      type: "data",
      confidence: 0.85,
      target: field,
      reason: `keyword: data field ${field}`
    };
  }
  return undefined;
}

// Re-export EditType so Stream C can import just from the classifier path.
export type { AIEditClassification, ClassifierInput, EditType };
