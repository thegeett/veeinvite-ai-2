/**
 * VeeInvite — shared types.
 *
 * Every layer of the CSS JSON pipeline imports from this file.
 */

export interface CoupleData {
  id?: string;
  userId?: string;
  slug?: string;
  person1Name: string;
  person2Name: string;
  /** Display-friendly date, e.g. "21 June 2025". */
  weddingDate: string;
  /** ISO timestamp used for the countdown target. */
  weddingDateIso: string;
  venueName: string;
  venueCity: string;
  rsvpDeadline?: string;
  style: string;
  vibe: string;
  story: string;
  culturalContext: string;
  themeJson?: ThemeJSON;
  styleHistory?: string[];
  siteHtmlUrl?: string;
  isPublished?: boolean;
}

export interface WeddingEvent {
  id?: string;
  coupleId?: string;
  name: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  sortOrder?: number;
  /** "One" / "Two" / "Three" — injected by renderer. */
  number?: string;
}

export type StylesMap = Record<string, Record<string, string>>;

export type ParticleEffect =
  | 'none'
  | 'petals'
  | 'snow'
  | 'fireflies'
  | 'sparkles';

export interface ParticleConfig {
  effect: ParticleEffect;
  colors: string[];
  count: number;
  opacity: number;
}

export interface ContentMap {
  TAGLINE: string;
  CTA_LABEL: string;

  STORY_EYEBROW: string;
  STORY_SCRIPT_TITLE: string;
  STORY_HEADING: string;
  STORY_P1: string;
  STORY_QUOTE: string;
  STORY_P2: string;

  EVENTS_EYEBROW: string;
  EVENTS_HEADING: string;

  EVENT_1_NUMBER: string;
  EVENT_1_NAME: string;
  EVENT_2_NUMBER: string;
  EVENT_2_NAME: string;
  EVENT_3_NUMBER: string;
  EVENT_3_NAME: string;

  MAP_LINK_LABEL: string;

  RSVP_EYEBROW: string;
  RSVP_HEADING: string;
  RSVP_SUB: string;
  RSVP_ACCEPT_LABEL: string;
  RSVP_DECLINE_LABEL: string;
  RSVP_SUBMIT_LABEL: string;
  RSVP_SUCCESS_TITLE: string;
  RSVP_SUCCESS_MESSAGE: string;

  GALLERY_EYEBROW: string;
  GALLERY_HEADING: string;
  GALLERY_SUB: string;

  FAQ_HEADING: string;
  FAQ_1_Q: string;
  FAQ_1_A: string;
  FAQ_2_Q: string;
  FAQ_2_A: string;
  FAQ_3_Q: string;
  FAQ_3_A: string;
  FAQ_4_Q: string;
  FAQ_4_A: string;
  FAQ_5_Q: string;
  FAQ_5_A: string;
  FAQ_6_Q: string;
  FAQ_6_A: string;

  FOOTER_TAGLINE: string;
}

export interface ReasoningBlock {
  palette: string;
  fonts: string;
  mood: string;
}

export interface ThemeJSON {
  styles: StylesMap;
  fonts: string[];
  particles: ParticleConfig;
  content: ContentMap;
  reasoning?: ReasoningBlock;
}

export interface RSVPData {
  id?: string;
  coupleId: string;
  firstName: string;
  lastName: string;
  email: string;
  attending: boolean;
  guestCount: number;
  dietary?: string;
  message?: string;
  createdAt?: string;
}

export interface ValidationResult {
  validStyles: StylesMap;
  validFonts: string[];
  validParticles: ParticleConfig;
  validContent: ContentMap;
  errors: string[];
  warnings: string[];
}

export interface BuildSiteParams {
  skeleton: string;
  styles: StylesMap;
  fonts: string[];
  particles: ParticleConfig;
  content: ContentMap;
  couple: CoupleData;
  events: WeddingEvent[];
}
