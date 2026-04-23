// injectStructured — runs LAST in the renderer (architecture rule 7).
//
// Real names/dates/venues from the DB unconditionally overwrite any AI copy.
// If Call 2 or Call 3 hallucinated a different name, this step erases the
// mistake. Photo references are emitted as `{{PHOTO:...}}` markers — NEVER
// raw Supabase URLs — so Stream C's route handlers can swap in 1-hour signed
// URLs at serve time (see DECISIONS [2026-01]).

import type { CoupleData } from "@/lib/types";

interface InjectStructuredInput {
  html: string;
  couple: CoupleData;
  bilingualFields?: Record<string, string>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function monogram(p1: string, p2: string): string {
  const i1 = (p1?.trim()?.[0] ?? "").toUpperCase();
  const i2 = (p2?.trim()?.[0] ?? "").toUpperCase();
  return `${i1}${i2}`;
}

function replaceAllLiteral(src: string, needle: string, replacement: string): string {
  if (!needle) return src;
  return src.split(needle).join(replacement);
}

/**
 * Substitutes every structured placeholder with real DB values. Bilingual
 * placeholders fall back to empty strings when `bilingualEnabled` is false
 * (§33 — v1 accommodates, M2 activates).
 *
 * Photo markers: for each path in couple.photo_urls emit
 *   {{PHOTO:<path>}}
 * which Stream C replaces with a signed URL at serve time.
 */
export function injectStructured(input: InjectStructuredInput): string {
  const { couple, bilingualFields } = input;
  let html = input.html;

  const p1 = escapeHtml(couple.person1_name ?? "");
  const p2 = escapeHtml(couple.person2_name ?? "");
  const weddingDate = escapeHtml(couple.wedding_date ?? "");
  const weddingDateIso = escapeHtml(couple.wedding_date_iso ?? couple.wedding_date ?? "");
  const venueName = escapeHtml(couple.venue_name ?? "");
  const venueCity = escapeHtml(couple.venue_city ?? "");
  const slug = escapeHtml(couple.slug ?? "");

  const map: Record<string, string> = {
    "{{PERSON1_NAME}}": p1,
    "{{PERSON2_NAME}}": p2,
    "{{MONOGRAM}}": escapeHtml(monogram(couple.person1_name, couple.person2_name)),
    "{{WEDDING_DATE}}": weddingDate,
    "{{WEDDING_DATE_DISPLAY}}": weddingDate,
    "{{WEDDING_DATE_ISO}}": weddingDateIso,
    "{{COUNTDOWN_TARGET}}": weddingDateIso,
    "{{VENUE_NAME}}": venueName,
    "{{VENUE_CITY}}": venueCity,
    "{{SLUG}}": slug,
    // §33 bilingual — empty strings in v1 unless the flag is active.
    "{{PERSON1_NAME_BILINGUAL}}": escapeHtml(bilingualFields?.person1_name ?? ""),
    "{{PERSON2_NAME_BILINGUAL}}": escapeHtml(bilingualFields?.person2_name ?? ""),
    "{{WEDDING_DATE_BILINGUAL}}": escapeHtml(bilingualFields?.wedding_date ?? ""),
    "{{VENUE_NAME_BILINGUAL}}": escapeHtml(bilingualFields?.venue_name ?? "")
  };

  for (const [key, value] of Object.entries(map)) {
    html = replaceAllLiteral(html, key, value);
  }

  // Photo markers — §DECISIONS [2026-01].
  // Substitute only the N-th photo marker with the corresponding path. If the
  // hero/gallery emitted `{{PHOTO:1}}` shorthand it resolves to photo_urls[0].
  // Absolute paths already inside markers are preserved.
  const photoUrls = Array.isArray(couple.photo_urls) ? couple.photo_urls : [];
  html = html.replace(/{{PHOTO:(\d+)}}/g, (_m, idx) => {
    const i = Number(idx);
    const path = photoUrls[i];
    return path ? `{{PHOTO:${path}}}` : "";
  });

  return html;
}
