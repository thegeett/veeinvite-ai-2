// Load a couple + events from DB, call the renderer, and re-upload HTML.
// Used by /api/structured (data-only edits) and /api/restore.
//
// Does NOT create a site_versions row — the caller decides when to version
// (edits do, RSVP config tweaks do, but raw structured name fixes may not).

import { createAdmin } from "@/lib/supabase/admin";
import { rowToCouple, rowToEvent } from "@/lib/db/mappers";
import { uploadSiteHtml } from "@/lib/storage/html";
import { render } from "@/lib/renderer";
import type {
  CoupleData,
  EventData,
  RSVPConfig,
  ThemeJSON,
  LayoutId
} from "@/lib/types";

export interface ReRenderOverrides {
  themeJson?: ThemeJSON;
  heroHtml?: string;
  layoutId?: LayoutId;
}

export interface ReRenderResult {
  html: string;
  siteUrl: string;
  couple: CoupleData;
  events: EventData[];
}

/**
 * Read the couple + events from DB, render with current theme/hero/layout
 * (or overrides), and write to storage.
 *
 * Returns the freshly-rendered HTML and couple row. Does not mutate the
 * couples row — the caller updates any columns (layout_id, theme_json, etc.)
 * explicitly before calling this.
 */
export async function reRenderAndUpload(
  coupleId: string,
  overrides: ReRenderOverrides = {}
): Promise<ReRenderResult> {
  const supabase = createAdmin();

  const [{ data: coupleRow }, { data: eventRows }] = await Promise.all([
    supabase.from("couples").select("*").eq("id", coupleId).single(),
    supabase.from("events").select("*").eq("couple_id", coupleId).order("sort_order")
  ]);

  if (!coupleRow) throw new Error(`couple ${coupleId} not found`);

  const couple = rowToCouple(coupleRow);
  const events = (eventRows ?? []).map(rowToEvent);

  const themeJson = overrides.themeJson ?? couple.theme_json;
  const heroHtml = overrides.heroHtml ?? couple.hero_html ?? "";
  const layoutId = overrides.layoutId ?? couple.layout_id ?? "layout-1";

  if (!themeJson) {
    throw new Error(`couple ${coupleId} has no theme_json — generate first`);
  }

  const rsvpConfig: RSVPConfig = couple.rsvp_config ?? {
    guestCountEnabled: true,
    guestCountMax: 4,
    childrenSeparate: false,
    childrenMax: 5,
    plusOneEnabled: false,
    eventSelectionEnabled: events.length > 1,
    mealChoiceEnabled: false,
    mealOptions: [],
    dietaryEnabled: true,
    messageEnabled: true,
    songRequestEnabled: false
  };

  const html = render({
    layoutId,
    themeJson,
    heroHtml,
    culturalProfile: couple.cultural_profile,
    couple,
    events,
    rsvpConfig,
    customSections: couple.custom_sections
  });

  await uploadSiteHtml(couple.slug, html);
  const siteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/w/${couple.slug}`;

  return { html, siteUrl, couple, events };
}
