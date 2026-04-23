// Validator — plan §10.
//
// Every field in Call 2's JSON must flow through this module before the browser
// sees it. The validator NEVER throws (architecture rule 8). Bad values get
// safe defaults so the site always renders.
//
// - validateStyles          — strips forbidden CSS properties, drops dangerous values
// - validateFonts           — enforces the approved fonts list
// - validateParticles       — clamps numeric + enum values
// - validateContent         — fills missing keys with CONTENT_DEFAULTS
// - validateDangerousPatterns — scans arbitrary string blobs for script injection
// - validateAll             — master entry point, returns ValidationResult
//
// All exports are pure functions.

import type {
  ContentMap,
  ParticleConfig,
  ParticleEffect,
  StylesMap,
  ThemeJSON,
  ValidationResult
} from "@/lib/types";
import {
  APPROVED_FONTS,
  CONTENT_DEFAULTS,
  DANGEROUS_CSS_PATTERNS,
  FORBIDDEN_CSS_PROPERTIES
} from "@/lib/types";

const FORBIDDEN_PROP_SET: ReadonlySet<string> = new Set(FORBIDDEN_CSS_PROPERTIES);
const APPROVED_FONT_SET: ReadonlySet<string> = new Set(APPROVED_FONTS);
const ALLOWED_PARTICLE_EFFECTS: ReadonlySet<ParticleEffect> = new Set([
  "none",
  "petals",
  "snow",
  "fireflies",
  "sparkles"
]);

// ---------- Dangerous pattern scan -----------------------------------------

/**
 * Returns true if any dangerous CSS/JS pattern is present in the value.
 * Covers `javascript:`, `expression(`, `<script`, `@import`, `behaviour:`,
 * `-moz-binding`. Applies to any string field.
 */
export function containsDangerousPattern(value: string): boolean {
  return DANGEROUS_CSS_PATTERNS.some((rx) => rx.test(value));
}

/**
 * Walks an arbitrary JSON value and returns the list of string values that
 * match any dangerous pattern. Used by `validateAll` to decide warnings.
 * Never throws — treats non-object inputs as empty.
 */
export function validateDangerousPatterns(input: unknown): string[] {
  const hits: string[] = [];
  const seen = new WeakSet<object>();

  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      if (containsDangerousPattern(node)) hits.push(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    Object.values(node as Record<string, unknown>).forEach(walk);
  };

  try {
    walk(input);
  } catch {
    // never throws — circular structures are tracked via WeakSet
  }
  return hits;
}

// ---------- Styles ---------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strips forbidden properties (plan §10) and any property whose value contains
 * a dangerous pattern. Keeps the selector even if all its properties are
 * removed — downstream CSS builder handles empty blocks.
 */
export function validateStyles(raw: unknown): {
  valid: StylesMap;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const valid: StylesMap = {};

  if (!isPlainObject(raw)) {
    if (raw !== undefined && raw !== null) {
      warnings.push("styles was not an object — falling back to empty styles map");
    }
    return { valid, errors, warnings };
  }

  for (const [selector, props] of Object.entries(raw)) {
    if (typeof selector !== "string" || selector.trim() === "") continue;
    if (!isPlainObject(props)) {
      warnings.push(`styles["${selector}"] was not an object — dropped`);
      continue;
    }
    const cleaned: Record<string, string> = {};
    for (const [rawProp, rawValue] of Object.entries(props)) {
      const prop = String(rawProp).trim().toLowerCase();
      if (!prop) continue;
      if (FORBIDDEN_PROP_SET.has(prop)) {
        warnings.push(`styles["${selector}"].${prop} stripped (forbidden by §10)`);
        continue;
      }
      if (typeof rawValue !== "string" && typeof rawValue !== "number") {
        warnings.push(
          `styles["${selector}"].${prop} dropped — non-string value`
        );
        continue;
      }
      const value = String(rawValue);
      if (containsDangerousPattern(value)) {
        errors.push(
          `styles["${selector}"].${prop} rejected — dangerous pattern detected`
        );
        continue;
      }
      cleaned[prop] = value;
    }
    valid[selector] = cleaned;
  }

  return { valid, errors, warnings };
}

// ---------- Fonts ----------------------------------------------------------

/**
 * Accepts strings in the form "Font Name" or "Font Name:400,600".
 * Drops anything whose family is not on APPROVED_FONTS. Deduplicates.
 */
export function validateFonts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    if (containsDangerousPattern(entry)) continue;
    const family = entry.split(":")[0]?.trim();
    if (!family) continue;
    if (!APPROVED_FONT_SET.has(family)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push(entry);
  }
  return out;
}

// ---------- Particles ------------------------------------------------------

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Clamps count to 0–30, opacity to 0–0.7, colors to max 4 entries, effect to
 * the allowed enum. Unknown effects collapse to "none".
 */
export function validateParticles(raw: unknown): ParticleConfig {
  const p = (isPlainObject(raw) ? raw : {}) as Partial<ParticleConfig>;
  const effect = ALLOWED_PARTICLE_EFFECTS.has(p.effect as ParticleEffect)
    ? (p.effect as ParticleEffect)
    : "none";
  const colors = Array.isArray(p.colors)
    ? (p.colors as unknown[])
        .filter((c): c is string => typeof c === "string" && !containsDangerousPattern(c))
        .slice(0, 4)
    : [];
  return {
    effect,
    colors,
    count: Math.round(clampNumber(p.count, 0, 30, 0)),
    opacity: clampNumber(p.opacity, 0, 0.7, 0)
  };
}

// ---------- Content --------------------------------------------------------

/**
 * Merges AI content over CONTENT_DEFAULTS. Non-string values and keys with
 * dangerous patterns are dropped (default then wins). Ensures every default
 * key is present.
 */
export function validateContent(raw: unknown): {
  valid: ContentMap;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const valid: ContentMap = { ...CONTENT_DEFAULTS };

  if (!isPlainObject(raw)) {
    if (raw !== undefined && raw !== null) {
      warnings.push("content was not an object — falling back to defaults");
    }
    return { valid, errors, warnings };
  }

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") {
      warnings.push(`content["${key}"] dropped — non-string value`);
      continue;
    }
    if (containsDangerousPattern(value)) {
      errors.push(`content["${key}"] rejected — dangerous pattern detected`);
      continue;
    }
    if (value.trim() === "") continue;
    valid[key] = value;
  }

  return { valid, errors, warnings };
}

// ---------- Master ---------------------------------------------------------

/**
 * Runs every validator and returns a merged ValidationResult. Never throws —
 * if the input is null/undefined/garbage the result is all defaults.
 */
export function validateAll(parsed: unknown): ValidationResult {
  const input = (isPlainObject(parsed) ? parsed : {}) as Partial<ThemeJSON>;
  const stylesResult = validateStyles(input.styles);
  const contentResult = validateContent(input.content);
  const fonts = validateFonts(input.fonts);
  const particles = validateParticles(input.particles);
  const dangerousHits = validateDangerousPatterns(input);
  const warnings = [...stylesResult.warnings, ...contentResult.warnings];
  if (dangerousHits.length > 0) {
    warnings.push(
      `dangerous patterns scanned at top-level: ${dangerousHits.length} value(s) rejected inline`
    );
  }
  return {
    styles: stylesResult.valid,
    fonts,
    particles,
    content: contentResult.valid,
    errors: [...stylesResult.errors, ...contentResult.errors],
    warnings
  };
}
