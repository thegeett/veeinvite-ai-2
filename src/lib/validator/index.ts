// STUB — replaced by Stream B in Phase 2.
// The validator never throws (architecture rule 8). Bad values get safe defaults.
// See plan §10.

import type {
  ThemeJSON,
  ValidationResult,
  StylesMap,
  ContentMap,
  ParticleConfig
} from "@/lib/types";
import { CONTENT_DEFAULTS } from "@/lib/types";

export function validateStyles(raw: unknown): { valid: StylesMap; errors: string[]; warnings: string[] } {
  return { valid: (raw as StylesMap) ?? {}, errors: [], warnings: [] };
}

export function validateFonts(raw: unknown): string[] {
  return Array.isArray(raw) ? (raw as string[]) : [];
}

export function validateParticles(raw: unknown): ParticleConfig {
  const p = (raw ?? {}) as Partial<ParticleConfig>;
  return {
    effect: p.effect ?? "none",
    colors: Array.isArray(p.colors) ? p.colors.slice(0, 4) : [],
    count: Math.max(0, Math.min(30, Number(p.count ?? 0))),
    opacity: Math.max(0, Math.min(0.7, Number(p.opacity ?? 0)))
  };
}

export function validateContent(raw: unknown): { valid: ContentMap; errors: string[]; warnings: string[] } {
  const incoming = (raw ?? {}) as ContentMap;
  const valid: ContentMap = { ...CONTENT_DEFAULTS, ...incoming };
  return { valid, errors: [], warnings: [] };
}

export function validateAll(parsed: Partial<ThemeJSON>): ValidationResult {
  const styles = validateStyles(parsed.styles);
  const content = validateContent(parsed.content);
  return {
    styles: styles.valid,
    fonts: validateFonts(parsed.fonts),
    particles: validateParticles(parsed.particles),
    content: content.valid,
    errors: [...styles.errors, ...content.errors],
    warnings: [...styles.warnings, ...content.warnings]
  };
}
