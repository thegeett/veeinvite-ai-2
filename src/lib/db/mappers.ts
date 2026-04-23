// DB row → typed object conversion. DB stores JSON columns untyped; this layer
// asserts the contract with the rest of the code so routes do not do their own
// casting.
//
// Owned by Stream C. If you need a new mapper, add it here, not inline.

import type {
  CoupleData,
  EventData,
  RSVPData,
  SiteVersion,
  CustomSection,
  CulturalProfile,
  RSVPConfig,
  ThemeJSON,
  GlobalTokens,
  LayoutId,
  PreviewToken
} from "@/lib/types";

type JsonRow = Record<string, unknown>;

function asJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  return value as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function rowToCouple(row: JsonRow): CoupleData {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    slug: String(row.slug),
    person1_name: String(row.person1_name ?? ""),
    person2_name: String(row.person2_name ?? ""),
    wedding_date: String(row.wedding_date ?? ""),
    wedding_date_iso: String(row.wedding_date_iso ?? ""),
    venue_name: String(row.venue_name ?? ""),
    venue_city: String(row.venue_city ?? ""),
    rsvp_deadline: (row.rsvp_deadline as string | null) ?? null,
    style: (row.style as string | null) ?? null,
    vibe: (row.vibe as string | null) ?? null,
    story: (row.story as string | null) ?? null,
    cultural_context: (row.cultural_context as string | null) ?? null,
    layout_id: (row.layout_id as LayoutId | null) ?? null,
    cultural_profile: asJson<CulturalProfile | null>(row.cultural_profile, null),
    rsvp_config: asJson<RSVPConfig | null>(row.rsvp_config, null),
    global_tokens: asJson<GlobalTokens | null>(row.global_tokens, null),
    theme_json: asJson<ThemeJSON | null>(row.theme_json, null),
    hero_html: (row.hero_html as string | null) ?? null,
    design_summary: (row.design_summary as string | null) ?? null,
    custom_sections: asArray<CustomSection>(row.custom_sections),
    photo_urls: asArray<string>(row.photo_urls),
    site_html_url: (row.site_html_url as string | null) ?? null,
    is_published: Boolean(row.is_published),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? "")
  };
}

export function rowToEvent(row: JsonRow): EventData {
  return {
    id: String(row.id),
    couple_id: String(row.couple_id),
    name: String(row.name ?? ""),
    event_type: (row.event_type as string | null) ?? null,
    event_date: String(row.event_date ?? ""),
    event_time: String(row.event_time ?? ""),
    venue: String(row.venue ?? ""),
    dress_code: (row.dress_code as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0)
  };
}

export function rowToRsvp(row: JsonRow): RSVPData {
  return {
    id: String(row.id),
    couple_id: String(row.couple_id),
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    email: String(row.email ?? ""),
    attending: Boolean(row.attending),
    guest_count: Number(row.guest_count ?? 1),
    children_count: Number(row.children_count ?? 0),
    plus_one_name: (row.plus_one_name as string | null) ?? null,
    events_attending: asArray<string>(row.events_attending),
    meal_choice: (row.meal_choice as string | null) ?? null,
    dietary: (row.dietary as string | null) ?? null,
    song_request: (row.song_request as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    created_at: String(row.created_at ?? "")
  };
}

export function rowToSiteVersion(row: JsonRow): SiteVersion {
  return {
    id: String(row.id),
    couple_id: String(row.couple_id),
    version_number: Number(row.version_number ?? 0),
    layout_id: (row.layout_id as LayoutId | null) ?? null,
    hero_html: (row.hero_html as string | null) ?? null,
    global_tokens: asJson<GlobalTokens | null>(row.global_tokens, null),
    theme_json: asJson<ThemeJSON>(row.theme_json, {} as ThemeJSON),
    design_summary: (row.design_summary as string | null) ?? null,
    instruction: (row.instruction as string | null) ?? null,
    label: (row.label as string | null) ?? null,
    created_at: String(row.created_at ?? "")
  };
}

export function rowToPreviewToken(row: JsonRow): PreviewToken {
  return {
    token: String(row.token),
    couple_id: String(row.couple_id),
    expires_at: String(row.expires_at),
    created_at: String(row.created_at ?? "")
  };
}

/** Generate a URL-safe slug from two names. Keeps Unicode letters; lowercases ASCII. */
export function slugifyNames(person1: string, person2: string): string {
  const base = `${person1}-and-${person2}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : `couple-${suffix}`;
}
