// -----------------------------------------------------------------------------
// VeeInvite — Canonical Type Contract
//
// This file is the single source of truth for types across all three streams.
// Only Stream B (engine) edits it. Streams A and C read it.
//
// If you need a new type, propose it via a commit message tag:
//     TYPES: added X for Y reason
//
// Do NOT add engine logic to this file. Types only.
//
// Section references are to doc/VEEINVITE_PRODUCT_PLAN.md.
// -----------------------------------------------------------------------------

// =============================================================================
// §9, §10 — AI Pipeline output + validation
// =============================================================================

/**
 * Established once by Call 2 and reused as hard constraints by Call 3.
 * Every section of the site draws from these values for coherence (§5).
 */
/**
 * The 4 "expressive" tokens chosen upstream of Calls 2 + 3 by the Haiku
 * pre-call (PALETTE-03). They drive visual drama: bgPrimary is the canvas,
 * accent is the highlight/CTA color, gold is the metallic decorative tone,
 * fontDisplay is the couple's-names font. Stored as `hsl(H, S%, L%)` strings
 * (Phase 3) — Phase 1 just persists whatever the pre-call returns when it
 * eventually wires up. See `precall_palette_architecture.md`.
 */
export interface ExpressivePalette {
  bgPrimary: string;
  accent: string;
  gold: string;
  fontDisplay: string;
}

/**
 * Design-weight axes for cultural couples (PALETTE-01). The cultural color
 * palette is fixed by `cultural-content-library.json` HSL ranges; vibe tags
 * adjust these dimensions instead. See `VIBE_TAG_PICKER_SPEC.md`.
 */
export interface DesignWeight {
  motifIntensity: "subtle" | "medium" | "prominent";
  density: "minimal" | "balanced" | "ornate";
  materialType: "parchment" | "silk" | "marble" | "velvet";
  animationLevel: "static" | "gentle" | "ambient";
}

export interface GlobalTokens {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  accent: string;
  accentLight: string;
  gold: string;
  textPrimary: string;
  textMuted: string;
  textSubtle: string;
  fontDisplay: string;
  fontHeading: string;
  fontBody: string;
}

/** CSS property → value map for one selector. */
export type CssProperties = Record<string, string>;

/** CSS selector → CSS properties map. */
export type StylesMap = Record<string, CssProperties>;

/** Placeholder token (e.g. "TAGLINE") → content string. */
export type ContentMap = Record<string, string>;

export type ParticleEffect = "none" | "petals" | "snow" | "fireflies" | "sparkles";

export interface ParticleConfig {
  effect: ParticleEffect;
  colors: string[];
  count: number;
  opacity: number;
}

/**
 * Full output of AI Call 2 (§9). This is the source-of-truth design bundle
 * that is stored in the `couples.theme_json` DB column.
 */
export interface ThemeJSON {
  globalTokens: GlobalTokens;
  styles: StylesMap;
  fonts: string[];
  particles: ParticleConfig;
  content: ContentMap;
  designSummary: string;
  reasoning?: {
    palette?: string;
    fonts?: string;
    mood?: string;
  };
}

export interface ValidationResult {
  styles: StylesMap;
  fonts: string[];
  particles: ParticleConfig;
  content: ContentMap;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Phase B — Call 3 JSON envelope
// =============================================================================
// Phase B replaces Call 3's raw-HTML output with a JSON envelope. Our code
// owns the <section class="hero">, <style>, and <script> wrappers; AI owns
// the content inside each field. See doc/hero_html_extraction.md.

export interface HeroJsonEnvelope {
  /** Inner HTML of the hero — names, date, venue, countdown, CTA, decorations.
   *  MUST NOT include <section>, <style>, or <script> tags. The assembler
   *  wraps this in <section class="hero"> and injects the style/script blocks. */
  html: string;
  /** All CSS for the hero. Raw CSS rules — no <style> tags. */
  style: string;
  /** All JavaScript for the hero. Raw JS — no <script> tags.
   *  Empty string if no script is needed. */
  script: string;
}

// =============================================================================
// §6, §7 — Layouts
// =============================================================================

export type LayoutId = "layout-1" | "layout-2" | "layout-3" | "layout-4";

export interface LayoutMeta {
  id: LayoutId;
  name: string;
  description: string;
  tags: string[];
  antiTags: string[];
  bestFor: string;
}

// =============================================================================
// §25, §27 — Style cards + vibe tags
// =============================================================================

export type StyleCard =
  | "Modern Minimalist"
  | "Romantic Traditional"
  | "Bohemian Garden"
  | "Elegant Minimal"
  | "South Asian Grand"
  | "Destination Glamour"
  | "Editorial Bold";

/** Mapping from style card → layoutId, per §25 table. */
export const STYLE_CARD_TO_LAYOUT: Record<StyleCard, LayoutId> = {
  "Modern Minimalist": "layout-1",
  "Romantic Traditional": "layout-2",
  "Bohemian Garden": "layout-1",
  "Elegant Minimal": "layout-1",
  "South Asian Grand": "layout-3",
  "Destination Glamour": "layout-4",
  "Editorial Bold": "layout-4"
};

/**
 * Suggested layout per culture (plan §25 table). Used as the step-1 default
 * only — a style card, once picked, wins over any culture suggestion.
 * Keys match `CulturalProfile.id` values from the cultural content library.
 */
export const CULTURE_TO_SUGGESTED_LAYOUT: Record<string, LayoutId> = {
  hindu_indian: "layout-3",
  sikh: "layout-3",
  muslim: "layout-3",
  chinese: "layout-4",
  jewish: "layout-2",
  nigerian_yoruba: "layout-4",
  nigerian_igbo: "layout-4",
  latin_american_catholic: "layout-2",
  western: "layout-1"
};

// =============================================================================
// §26 — Cultural profile system
// =============================================================================

/**
 * Where a cultural content item appears on the generated site (§26).
 * The renderer routes content items to the correct injection point based on this.
 */
export type SectionType =
  | "hero_eyebrow"
  | "hero_names_area"
  | "hero_date_area"
  | "hero_cta_area"
  | "story"
  | "events"
  | "rsvp"
  | "gallery"
  | "faq"
  | "custom_section"
  | "footer";

export type FieldType = "text" | "textarea" | "select" | "boolean" | "array";

export interface FieldDefinition {
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  default?: string | boolean | string[];
  itemFields?: FieldDefinition[];
}

export interface ContentItemDefinition {
  id: string;
  label: string;
  description: string;
  section: SectionType;
  fields: FieldDefinition[];
  defaultIncluded: boolean;
  optional: boolean;
  displayNote?: string;
  customSectionLabel?: string;
}

export interface CeremonyDefinition {
  id: string;
  name: string;
  defaultIncluded: boolean;
  optional: boolean;
  description: string;
  note?: string;
}

export interface SubRegionSelectedCeremony {
  id: string;
  name?: string;
  defaultIncluded: boolean;
  note?: string;
  description?: string;
}

export interface SubRegionAdditionalCeremony {
  id: string;
  name: string;
  description: string;
}

export interface SubRegionCeremonies {
  note: string;
  copyNote: string;
  selected: SubRegionSelectedCeremony[];
  additional: SubRegionAdditionalCeremony[];
}

export interface CultureDefinition {
  id: string;
  displayName: string;
  description: string;
  philosophy: string;
  suggestedLayout: LayoutId;
  subRegions?: string[];
  designGuidance: string;
  copyTone: string;
  copyGuardrails?: string;
  contentItems: ContentItemDefinition[];
  ceremonies: {
    default: CeremonyDefinition[];
    subRegions?: Record<string, SubRegionCeremonies>;
  };
}

/** Universal content available to all cultures (dress code, accommodation, etc). */
export interface UniversalContentLibrary {
  items: ContentItemDefinition[];
}

export interface CulturalContentLibrary {
  version: string;
  sectionTypes: Record<SectionType, string>;
  cultures: Record<string, CultureDefinition>;
  universalContent: UniversalContentLibrary;
}

/**
 * Ceremony in display/configurator form — returned by `getCeremoniesForCouple`.
 * Carries `displaySource` so the UI can distinguish pre-selected sub-region
 * ceremonies from "also available" defaults.
 */
export interface DisplayCeremony {
  id: string;
  name: string;
  defaultIncluded: boolean;
  optional: boolean;
  description: string;
  note?: string;
  availabilityNote?: string;
  displaySource: "subregion" | "default" | "additional";
}

/**
 * One culture chosen by the couple in the step-2 configurator. Interfaith
 * couples produce more than one of these; the server merges them via
 * `buildMergedCulturalProfile()` into a single `CulturalProfile`.
 */
export type CultureSelection = {
  cultureId: string;
  subRegion?: string;
  confirmedContentItemIds: string[];
  confirmedCeremonyIds: string[];
};

/**
 * The confirmed cultural profile as stored in DB (`couples.cultural_profile`).
 * Produced by `buildCulturalProfile()` after the couple completes the configurator.
 */
export interface CulturalProfile {
  id: string;
  subRegion?: string;
  displayName: string;

  contentItems: Array<{
    id: string;
    label: string;
    section: SectionType;
    customSectionLabel?: string;
    fields: FieldDefinition[];
    included: boolean;
    values: Record<string, string>;
  }>;

  ceremonies: Array<{
    id: string;
    name: string;
    included: boolean;
    date?: string;
    time?: string;
    venue?: string;
    source: "subregion" | "default" | "additional";
  }>;

  designGuidance: string;
  copyTone: string;
  copyGuardrails: string;
  subRegionCopyNote?: string;

  // §33 Bilingual — v1 accommodates, M2 activates
  bilingualEnabled: boolean;
  bilingualLanguage?: "zh" | "ar" | "he";
  bilingualDirection?: "ltr" | "rtl";
  bilingualFields?: Record<string, string>;
}

/** Conflict surfaced when multiple cultures select items competing for the same slot (§26). */
export interface CulturalConflict {
  section: SectionType;
  items: Array<{ cultureId: string; itemId: string; label: string }>;
  kind: "duplicate_section_slot";
}

// =============================================================================
// §29 — RSVP form configuration
// =============================================================================

export interface RSVPConfig {
  guestCountEnabled: boolean;
  guestCountMax: number;
  childrenSeparate: boolean;
  childrenMax: number;
  plusOneEnabled: boolean;
  eventSelectionEnabled: boolean;
  mealChoiceEnabled: boolean;
  mealOptions: string[];
  dietaryEnabled: boolean;
  messageEnabled: boolean;
  songRequestEnabled: boolean;
}

// =============================================================================
// §23 — Database rows
// =============================================================================

export interface CoupleData {
  id: string;
  user_id: string;
  slug: string;
  person1_name: string;
  person2_name: string;
  wedding_date: string;
  wedding_date_iso: string;
  venue_name: string;
  venue_city: string;
  rsvp_deadline: string | null;
  style: string | null;
  vibe: string | null;
  story: string | null;
  cultural_context: string | null;
  /** Original CultureSelection[] submitted in step 2 / Brief. Persisted alongside
   * `cultural_profile` (the merged output) so the configurator can round-trip
   * for editing — interfaith couples keep their secondary picks. See plan §34.5. */
  cultures: CultureSelection[];
  /** Selected vibe tags from the tag picker (PALETTE-01). For western couples
   *  these select the aesthetic family; for cultural couples they adjust
   *  design weight. See `VIBE_TAG_PICKER_SPEC.md`. */
  vibe_tags: string[];
  /** The 4 expressive tokens chosen by the Haiku pre-call (PALETTE-03).
   *  Persisted so design edits don't drift the palette. Null until Phase 3
   *  ships and a generation has run. */
  expressive_palette: ExpressivePalette | null;
  layout_id: LayoutId | null;
  cultural_profile: CulturalProfile | null;
  rsvp_config: RSVPConfig | null;
  global_tokens: GlobalTokens | null;
  theme_json: ThemeJSON | null;
  hero_html: string | null;
  design_summary: string | null;
  custom_sections: CustomSection[];
  photo_urls: string[];
  site_html_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventData {
  id: string;
  couple_id: string;
  name: string;
  event_type: string | null;
  event_date: string;
  event_time: string;
  venue: string;
  dress_code: string | null;
  sort_order: number;
}

export interface RSVPData {
  id: string;
  couple_id: string;
  first_name: string;
  last_name: string;
  email: string;
  attending: boolean;
  guest_count: number;
  children_count: number;
  plus_one_name: string | null;
  events_attending: string[];
  meal_choice: string | null;
  dietary: string | null;
  song_request: string | null;
  message: string | null;
  created_at: string;
}

export interface SiteVersion {
  id: string;
  couple_id: string;
  version_number: number;
  layout_id: LayoutId | null;
  hero_html: string | null;
  global_tokens: GlobalTokens | null;
  theme_json: ThemeJSON;
  design_summary: string | null;
  instruction: string | null;
  label: string | null;
  created_at: string;
}

export interface CustomSection {
  id: string;
  label: string;
  html: string;
  position: number;
  createdAt: string;
}

export interface PreviewToken {
  token: string;
  couple_id: string;
  expires_at: string;
  created_at: string;
}

// =============================================================================
// §28 — Quiz answers (onboarding input shapes)
// =============================================================================

export interface QuizStep1Answers {
  person1_name: string;
  person2_name: string;
  wedding_date_iso: string;
  wedding_date: string;
  venue_name: string;
  venue_city: string;
}

export interface QuizStep2Answers {
  styleCard?: StyleCard;
  /** Selected tag ids from the structured tag picker (PALETTE-01). Replaces
   *  the old free-text `vibeWords` array. For western couples these select
   *  the aesthetic family; for cultural couples they adjust design weight. */
  vibeTags: string[];
  story?: string;
  cultures: CultureSelection[];
  contentValues: Record<string, string>;
  events: Array<Omit<EventData, "id" | "couple_id">>;
}

// =============================================================================
// §12, §30 — Chat edit classification
// =============================================================================

export type EditType = "design" | "hero" | "global" | "data" | "content" | "new_section";

export interface AIEditClassification {
  type: EditType;
  /** Placeholder key or CSS selector the edit targets, when determinable. */
  target?: string;
  confidence: number;
  reason?: string;
}

export interface ChatEditInput {
  coupleId: string;
  instruction: string;
  contentPickerTarget?: string;
  elementPickerSelectors?: string[];
}

// =============================================================================
// Engine I/O shapes — consumed by §4 pipeline orchestrator
// =============================================================================

export interface Call2Input {
  skeletonHtml: string;
  layoutId: LayoutId;
  couple: Pick<CoupleData,
    "person1_name" | "person2_name" | "wedding_date" | "venue_name" | "venue_city" |
    "style" | "vibe" | "story" | "cultural_context">;
  culturalProfile: CulturalProfile | null;
  tags: string[];
}

export interface Call3Input {
  globalTokens: GlobalTokens;
  couple: Pick<CoupleData,
    "person1_name" | "person2_name" | "wedding_date" | "venue_name" | "venue_city" |
    "style" | "vibe" | "story">;
  culturalProfile: CulturalProfile | null;
}

export interface ClassifierInput {
  instruction: string;
  contentPickerTarget?: string;
  elementPickerSelectors?: string[];
}

export interface RenderInput {
  layoutId: LayoutId;
  themeJson: ThemeJSON;
  heroHtml: string;
  culturalProfile: CulturalProfile | null;
  couple: CoupleData;
  events: EventData[];
  rsvpConfig: RSVPConfig;
  customSections: CustomSection[];
}

/**
 * Input for the pipeline orchestrator. Stream C is responsible for looking up
 * (or upserting) the full CoupleData row before calling `generateSite` —
 * photos, custom sections, and rsvp_config all live on that row and the
 * pipeline needs them for rendering.
 */
export interface GenerateSiteInput {
  quizAnswers: QuizStep1Answers & Partial<QuizStep2Answers>;
  couple: CoupleData;
  events?: EventData[];
  /** Skip Anthropic calls (tests, restore flows). */
  themeOverride?: ThemeJSON;
  heroOverride?: string;
}

export interface GenerateSiteOutput {
  html: string;
  themeJson: ThemeJSON;
  heroHtml: string;
  layoutId: LayoutId;
  globalTokens: GlobalTokens;
  designSummary: string;
  culturalProfile: CulturalProfile | null;
}

// =============================================================================
// Section-placement helpers (§26 — where cultural content goes)
// =============================================================================

export const SECTION_TYPE_TARGETS: Record<SectionType, string> = {
  hero_eyebrow: "Injected above couple names in hero",
  hero_names_area: "Injected below couple names in hero",
  hero_date_area: "Injected near the wedding date in hero",
  hero_cta_area: "Injected near the RSVP button in hero (must be impossible to miss)",
  story: "Story section",
  events: "Event cards (typically handled by ceremony loop, not content items)",
  rsvp: "RSVP section configuration",
  gallery: "Gallery section",
  faq: "Appended as a FAQ item",
  custom_section: "Generated as a new full section before the footer",
  footer: "Appended to footer below couple names"
};

// =============================================================================
// Approved fonts and forbidden properties — used by validator (§10)
// =============================================================================

export const APPROVED_FONTS = [
  "Great Vibes",
  "Cormorant Garamond",
  "Playfair Display",
  "EB Garamond",
  "Jost",
  "Inter",
  "Lato",
  "Raleway",
  "Montserrat",
  "Fraunces",
  "DM Sans",
  "Libre Baskerville",
  "Poppins",
  "Josefin Sans",
  "Crimson Text",
  "Yeseva One"
] as const;

export type ApprovedFont = typeof APPROVED_FONTS[number];

export const FORBIDDEN_CSS_PROPERTIES = [
  "display", "position", "flex-direction", "flex-wrap",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
  "overflow", "overflow-x", "overflow-y",
  "width", "height", "min-height", "max-height", "min-width", "max-width",
  "float", "clear", "pointer-events",
  "top", "left", "right", "bottom", "inset",
  "align-items", "justify-content", "gap",
  "flex", "flex-grow", "flex-shrink", "flex-basis"
] as const;

export const DANGEROUS_CSS_PATTERNS = [
  /javascript:/i,
  /expression\(/i,
  /<script/i,
  /@import/i,
  /behaviour:/i,
  /-moz-binding/i
] as const;

// =============================================================================
// §28 — Content defaults (safe fallbacks — validator applies these)
// =============================================================================

export const CONTENT_DEFAULTS: Record<string, string> = {
  TAGLINE: "Together forever",
  CTA_LABEL: "RSVP Now",
  STORY_EYEBROW: "Our Story",
  STORY_SCRIPT_TITLE: "A love story",
  STORY_HEADING: "Our journey together",
  STORY_P1: "Every great love story has a quiet beginning — a moment that, in time, turns out to be the start of everything.",
  STORY_QUOTE: "Some connections feel less like a beginning and more like a return to somewhere you always belonged.",
  STORY_P2: "And so we invite you to celebrate the path that led us here.",
  EVENTS_EYEBROW: "Celebrations",
  EVENTS_HEADING: "Our wedding events",
  MAP_LINK_LABEL: "Open in maps",
  RSVP_EYEBROW: "Kindly Respond",
  RSVP_HEADING: "Will you join us?",
  RSVP_SUB: "Please let us know by the date on your invitation.",
  RSVP_ACCEPT_LABEL: "Joyfully accepts",
  RSVP_DECLINE_LABEL: "Regretfully declines",
  RSVP_SUBMIT_LABEL: "Send with Love",
  RSVP_SUCCESS_TITLE: "Thank you",
  RSVP_SUCCESS_MESSAGE: "Your response has been received. We can't wait to celebrate with you.",
  GALLERY_EYEBROW: "Moments",
  GALLERY_HEADING: "Our favourite photos",
  GALLERY_SUB: "A few of the moments that shaped us.",
  FAQ_HEADING: "Guest questions",
  FOOTER_TAGLINE: "Made with love, for the people we love."
};
