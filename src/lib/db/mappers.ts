import type { CoupleData, WeddingEvent, ThemeJSON } from '../types';

/**
 * Map a raw Supabase couples row (snake_case) to CoupleData (camelCase).
 */
export function mapCoupleRow(row: Record<string, unknown> | null): CoupleData | null {
  if (!row) return null;
  return {
    id: row.id as string | undefined,
    userId: (row.user_id as string | undefined) ?? undefined,
    slug: (row.slug as string | undefined) ?? undefined,
    person1Name: (row.person1_name as string) ?? '',
    person2Name: (row.person2_name as string) ?? '',
    weddingDate: (row.wedding_date as string) ?? '',
    weddingDateIso: (row.wedding_date_iso as string) ?? '',
    venueName: (row.venue_name as string) ?? '',
    venueCity: (row.venue_city as string) ?? '',
    rsvpDeadline: (row.rsvp_deadline as string | undefined) ?? undefined,
    style: (row.style as string) ?? '',
    vibe: (row.vibe as string) ?? '',
    story: (row.story as string) ?? '',
    culturalContext: (row.cultural_context as string | null) ?? '',
    themeJson: (row.theme_json as ThemeJSON | undefined) ?? undefined,
    styleHistory: (row.style_history as string[] | null) ?? [],
    siteHtmlUrl: (row.site_html_url as string | null) ?? undefined,
    isPublished: (row.is_published as boolean | null) ?? false,
  };
}

export function mapEventRow(row: Record<string, unknown> | null): WeddingEvent | null {
  if (!row) return null;
  return {
    id: row.id as string | undefined,
    coupleId: row.couple_id as string | undefined,
    name: (row.name as string) ?? '',
    eventDate: (row.event_date as string) ?? '',
    eventTime: (row.event_time as string) ?? '',
    venue: (row.venue as string) ?? '',
    sortOrder: (row.sort_order as number | undefined) ?? 0,
  };
}

export function mapEventRows(rows: Record<string, unknown>[] | null): WeddingEvent[] {
  if (!rows) return [];
  return rows
    .map((r) => mapEventRow(r))
    .filter((e): e is WeddingEvent => e !== null);
}
