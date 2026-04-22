/**
 * Validator — safety net between the AI's JSON and the renderer.
 *
 * Guarantees:
 *   - Never throws. Every function wraps its logic in try/catch and
 *     returns a safe default when anything goes wrong.
 *   - Forbidden CSS layout properties are stripped.
 *   - Fonts outside the approved list are replaced with a default.
 *   - ContentMap always has every key populated.
 */

import type {
  ContentMap,
  ParticleConfig,
  StylesMap,
  ValidationResult,
} from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FORBIDDEN_PROPERTIES = new Set<string>([
  'display',
  'position',
  'flex-direction',
  'flex-wrap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'overflow',
  'overflow-x',
  'overflow-y',
  'width',
  'height',
  'min-height',
  'max-height',
  'min-width',
  'max-width',
  'float',
  'clear',
  'pointer-events',
  'top',
  'left',
  'right',
  'bottom',
  'inset',
  'align-items',
  'justify-content',
  'gap',
  'flex',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
]);

export const APPROVED_FONTS = new Set<string>([
  'Great Vibes',
  'Cormorant Garamond',
  'Playfair Display',
  'EB Garamond',
  'Jost',
  'Inter',
  'Lato',
  'Raleway',
  'Montserrat',
  'Fraunces',
  'DM Sans',
  'Libre Baskerville',
  'Poppins',
  'Josefin Sans',
  'Crimson Text',
  'Yeseva One',
]);

export const DEFAULT_FONT = 'Jost:wght@200;300;400';

export const DANGEROUS_PATTERNS: RegExp[] = [
  /javascript:/i,
  /expression\(/i,
  /<script/i,
  /@import/i,
  /behaviour:/i,
  /-moz-binding/i,
];

export const FORBIDDEN_SELECTORS = new Set<string>([
  'html',
  'head',
  'meta',
  'script',
  'link',
  'style',
]);

export const PARTICLE_EFFECTS = new Set<string>([
  'none',
  'petals',
  'snow',
  'fireflies',
  'sparkles',
]);

// ---------------------------------------------------------------------------
// Content defaults
// ---------------------------------------------------------------------------

export const CONTENT_DEFAULTS: ContentMap = {
  TAGLINE: 'Together forever',
  CTA_LABEL: 'RSVP Now',

  STORY_EYEBROW: 'Our Story',
  STORY_SCRIPT_TITLE: 'A love story',
  STORY_HEADING: 'Our journey together',
  STORY_P1: 'Our story began with a chance meeting and a moment that felt different.',
  STORY_QUOTE: 'Every adventure felt like coming home.',
  STORY_P2: 'We cannot wait to celebrate with the people who have been there all along.',

  EVENTS_EYEBROW: 'Join Us',
  EVENTS_HEADING: 'The Celebration',

  EVENT_1_NUMBER: 'One',
  EVENT_1_NAME: '',
  EVENT_2_NUMBER: 'Two',
  EVENT_2_NAME: '',
  EVENT_3_NUMBER: 'Three',
  EVENT_3_NAME: '',

  MAP_LINK_LABEL: 'View on Map',

  RSVP_EYEBROW: 'Kindly Reply',
  RSVP_HEADING: 'Will you join us?',
  RSVP_SUB: 'Please respond at your earliest convenience.',
  RSVP_ACCEPT_LABEL: 'Joyfully Accept',
  RSVP_DECLINE_LABEL: 'Regretfully Decline',
  RSVP_SUBMIT_LABEL: 'Send with Love',
  RSVP_SUCCESS_TITLE: 'Thank you',
  RSVP_SUCCESS_MESSAGE: 'We cannot wait to celebrate with you.',

  GALLERY_EYEBROW: 'Moments',
  GALLERY_HEADING: 'Our Gallery',
  GALLERY_SUB: 'Photos coming soon.',

  FAQ_HEADING: 'Everything you need to know',
  FAQ_1_Q: 'What is the dress code?',
  FAQ_1_A: 'Formal attire.',
  FAQ_2_Q: 'Is parking available?',
  FAQ_2_A: 'Yes, parking is available at the venue.',
  FAQ_3_Q: 'Are children welcome?',
  FAQ_3_A: 'We welcome children at the celebration.',
  FAQ_4_Q: 'Will there be vegetarian options?',
  FAQ_4_A: 'Yes, all dietary requirements are catered for.',
  FAQ_5_Q: 'What time should I arrive?',
  FAQ_5_A: 'Please arrive 15 minutes before the ceremony.',
  FAQ_6_Q: 'Is there accommodation nearby?',
  FAQ_6_A: 'Several hotels are located close to the venue.',

  FOOTER_TAGLINE: 'Made with love, for the people we love.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isDangerous(value: string): boolean {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(value)) return true;
  }
  return false;
}

function extractFontNameFromValue(value: string): string | null {
  // value like "'Great Vibes', cursive" or "Jost, sans-serif"
  const firstChunk = value.split(',')[0]?.trim() ?? '';
  const cleaned = firstChunk.replace(/["']/g, '').trim();
  return cleaned || null;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

const ALLOWED_INLINE_TAGS = /<\/?(?:em|strong)>/gi;

function sanitiseContentString(s: string): string {
  try {
    // Strip script tags, then any HTML except <em> <strong>
    const noScripts = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    const tmp = noScripts.replace(/\0/g, '');
    // Preserve <em>/<strong>, remove all other tags.
    const preserved: string[] = [];
    const placeheld = tmp.replace(ALLOWED_INLINE_TAGS, (m) => {
      preserved.push(m);
      return `\u0000${preserved.length - 1}\u0000`;
    });
    const stripped = placeheld.replace(/<[^>]*>/g, '');
    const restored = stripped.replace(/\u0000(\d+)\u0000/g, (_, i) => preserved[Number(i)] || '');
    return restored.trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// validateStyles
// ---------------------------------------------------------------------------

export function validateStyles(raw: unknown): {
  valid: StylesMap;
  errors: string[];
  warnings: string[];
} {
  const valid: StylesMap = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(raw)) {
    return { valid, errors: ['styles is not an object'], warnings };
  }

  for (const selector of Object.keys(raw)) {
    try {
      const s = selector.trim();
      if (!s) continue;
      if (FORBIDDEN_SELECTORS.has(s.toLowerCase())) {
        warnings.push(`Skipped forbidden selector "${s}"`);
        continue;
      }
      const props = (raw as Record<string, unknown>)[selector];
      if (!isPlainObject(props)) {
        warnings.push(`Skipped selector "${s}" — properties not an object`);
        continue;
      }
      const validProps: Record<string, string> = {};
      for (const [prop, value] of Object.entries(props)) {
        try {
          const p = prop.trim().toLowerCase();
          if (FORBIDDEN_PROPERTIES.has(p)) {
            warnings.push(`Stripped forbidden property "${p}" on "${s}"`);
            continue;
          }
          if (typeof value !== 'string') {
            warnings.push(`Skipped non-string value on "${s}" { "${p}": ... }`);
            continue;
          }
          const trimmed = value.trim();
          if (!trimmed) continue;
          if (isDangerous(trimmed)) {
            errors.push(`Rejected dangerous value on "${s}" { "${p}": ${JSON.stringify(trimmed)} }`);
            continue;
          }
          if (p === 'font-family') {
            const name = extractFontNameFromValue(trimmed);
            if (!name || !APPROVED_FONTS.has(name)) {
              warnings.push(`Rejected unapproved font "${name ?? ''}" on "${s}"`);
              continue;
            }
          }
          validProps[p] = trimmed;
        } catch (e) {
          warnings.push(`Error on property "${prop}" of "${s}": ${(e as Error).message}`);
        }
      }
      if (Object.keys(validProps).length > 0) {
        valid[s] = validProps;
      }
    } catch (e) {
      warnings.push(`Error on selector "${selector}": ${(e as Error).message}`);
    }
  }

  return { valid, errors, warnings };
}

// ---------------------------------------------------------------------------
// validateFonts
// ---------------------------------------------------------------------------

export function validateFonts(raw: unknown): string[] {
  try {
    if (!Array.isArray(raw)) return [DEFAULT_FONT];
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const base = item.split(':')[0]?.trim() ?? '';
      if (APPROVED_FONTS.has(base)) {
        out.push(item.trim());
        if (out.length >= 3) break;
      }
    }
    return out.length > 0 ? out : [DEFAULT_FONT];
  } catch {
    return [DEFAULT_FONT];
  }
}

// ---------------------------------------------------------------------------
// validateParticles
// ---------------------------------------------------------------------------

export function validateParticles(raw: unknown): ParticleConfig {
  const fallback: ParticleConfig = {
    effect: 'none',
    colors: [],
    count: 0,
    opacity: 0,
  };
  try {
    if (!isPlainObject(raw)) return fallback;
    const effectRaw = typeof raw.effect === 'string' ? raw.effect.toLowerCase() : 'none';
    const effect = (PARTICLE_EFFECTS.has(effectRaw) ? effectRaw : 'none') as ParticleConfig['effect'];

    let count = Number(raw.count);
    count = clamp(Number.isFinite(count) ? count : 0, 0, 30);

    let opacity = Number(raw.opacity);
    opacity = clamp(Number.isFinite(opacity) ? opacity : 0, 0, 0.7);

    let colors: string[] = [];
    if (Array.isArray(raw.colors)) {
      colors = raw.colors
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.trim())
        .filter((c) => c && !isDangerous(c))
        .slice(0, 4);
    }

    return { effect, colors, count, opacity };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// validateContent
// ---------------------------------------------------------------------------

export function validateContent(raw: unknown): {
  valid: ContentMap;
  errors: string[];
  warnings: string[];
} {
  const valid: ContentMap = { ...CONTENT_DEFAULTS };
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(raw)) {
    warnings.push('content is not an object — using defaults for everything');
    return { valid, errors, warnings };
  }

  (Object.keys(valid) as (keyof ContentMap)[]).forEach((key) => {
    try {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value !== 'string') {
        warnings.push(`Missing or non-string content "${key}" — using default`);
        return;
      }
      const cleaned = sanitiseContentString(value);
      if (!cleaned) {
        warnings.push(`Empty content for "${key}" after sanitisation — using default`);
        return;
      }
      valid[key] = cleaned;
    } catch (e) {
      warnings.push(`Error on content "${key}": ${(e as Error).message}`);
    }
  });

  return { valid, errors, warnings };
}

// ---------------------------------------------------------------------------
// validateAll
// ---------------------------------------------------------------------------

export function validateAll(parsed: unknown): ValidationResult {
  const styles = validateStyles(isPlainObject(parsed) ? parsed.styles : null);
  const fonts = validateFonts(isPlainObject(parsed) ? parsed.fonts : null);
  const particles = validateParticles(isPlainObject(parsed) ? parsed.particles : null);
  const content = validateContent(isPlainObject(parsed) ? parsed.content : null);

  const errors = [...styles.errors, ...content.errors];
  const warnings = [...styles.warnings, ...content.warnings];

  if (process.env.NODE_ENV !== 'production') {
    if (errors.length > 0) console.warn('[validator] errors:', errors);
    if (warnings.length > 0) console.warn('[validator] warnings:', warnings);
  }

  return {
    validStyles: styles.valid,
    validFonts: fonts,
    validParticles: particles,
    validContent: content.valid,
    errors,
    warnings,
  };
}
