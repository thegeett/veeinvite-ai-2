// Call 2 (design tokens + theme) validator — 6 deterministic rules.
//
// See doc/phase-b-validators.md §"Validator rules" for the contract. Unlike
// the Call 3 validator, this one does NOT trigger a fallback — Call 2's
// existing `validateAll` pipeline (src/lib/validator/index.ts) already fills
// missing keys with safe defaults, so the site always renders. This validator
// produces *warnings* the caller logs so we can spot the "sparse output / lost
// personality" failure mode without crashing the run.
//
// Rule numbering matches the Phase B doc.

import { APPROVED_FONTS } from "@/lib/types";
import type { ThemeJSON } from "@/lib/types";

export interface ValidateCall2JsonResult {
  ok: boolean;
  failures: string[];
}

const REQUIRED_GLOBAL_TOKEN_KEYS = [
  "bgPrimary",
  "bgSecondary",
  "bgCard",
  "accent",
  "accentLight",
  "gold",
  "textPrimary",
  "textMuted",
  "textSubtle",
  "fontDisplay",
  "fontHeading",
  "fontBody"
] as const;

const MIN_STYLE_SELECTORS = 25;
const MIN_CONTENT_VALUES = 30;
const MIN_DESIGN_SUMMARY_LEN = 30;

// Selectors that must appear in `styles` for the site to read as styled. This
// is a deliberate subset of the prompt's COMPLETENESS list — these are the
// load-bearing ones that, if missing, leave entire sections looking unstyled.
const REQUIRED_SELECTORS = [
  "body",
  "nav",
  ".story",
  ".story-heading",
  ".events",
  ".events-heading",
  ".rsvp",
  ".rsvp-heading",
  ".rsvp-submit",
  "footer"
] as const;

const APPROVED_FONT_SET: ReadonlySet<string> = new Set(APPROVED_FONTS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCall2Json(parsed: unknown): ValidateCall2JsonResult {
  const failures: string[] = [];

  if (!isPlainObject(parsed)) {
    failures.push("Call 2 output is not an object");
    return { ok: false, failures };
  }

  const theme = parsed as Partial<ThemeJSON>;

  // Rule 1 — globalTokens has all 12 required keys.
  if (!isPlainObject(theme.globalTokens)) {
    failures.push("Rule 1: globalTokens is missing or not an object");
  } else {
    const tokens = theme.globalTokens as Record<string, unknown>;
    for (const key of REQUIRED_GLOBAL_TOKEN_KEYS) {
      const v = tokens[key];
      if (typeof v !== "string" || v.trim() === "") {
        failures.push(`Rule 1: globalTokens.${key} is missing or empty`);
      }
    }
  }

  // Rule 2 — styles has ≥ 25 selectors.
  const styles = isPlainObject(theme.styles) ? theme.styles : {};
  const selectorCount = Object.keys(styles).length;
  if (selectorCount < MIN_STYLE_SELECTORS) {
    failures.push(
      `Rule 2: styles has ${selectorCount} selectors (min ${MIN_STYLE_SELECTORS}) — sparse output indicates AI gave up early`
    );
  }

  // Rule 3 — required selectors all present.
  for (const selector of REQUIRED_SELECTORS) {
    if (!(selector in styles)) {
      failures.push(`Rule 3: styles is missing required selector "${selector}"`);
    }
  }

  // Rule 4 — fonts non-empty, all entries on approved list.
  if (!Array.isArray(theme.fonts) || theme.fonts.length === 0) {
    failures.push("Rule 4: fonts is empty or not an array");
  } else {
    for (const entry of theme.fonts) {
      if (typeof entry !== "string") {
        failures.push("Rule 4: fonts contains a non-string entry");
        continue;
      }
      const family = entry.split(":")[0]?.trim() ?? "";
      if (!APPROVED_FONT_SET.has(family)) {
        failures.push(
          `Rule 4: fonts contains "${entry}" — family "${family}" is not on the approved list`
        );
      }
    }
  }

  // Rule 5 — content has ≥ 30 non-empty values.
  const content = isPlainObject(theme.content) ? theme.content : {};
  const nonEmptyContentCount = Object.values(content).filter(
    (v) => typeof v === "string" && v.trim() !== ""
  ).length;
  if (nonEmptyContentCount < MIN_CONTENT_VALUES) {
    failures.push(
      `Rule 5: content has ${nonEmptyContentCount} non-empty values (min ${MIN_CONTENT_VALUES}) — generic copy means personality is lost`
    );
  }

  // Rule 6 — designSummary ≥ 30 chars.
  if (typeof theme.designSummary !== "string" || theme.designSummary.trim().length < MIN_DESIGN_SUMMARY_LEN) {
    const len = typeof theme.designSummary === "string" ? theme.designSummary.trim().length : 0;
    failures.push(
      `Rule 6: designSummary is ${len} chars (min ${MIN_DESIGN_SUMMARY_LEN}) — needed for edit-prompt coherence`
    );
  }

  return { ok: failures.length === 0, failures };
}
