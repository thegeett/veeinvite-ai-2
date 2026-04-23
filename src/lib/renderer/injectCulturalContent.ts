// injectCulturalContent — plan §26.
//
// Routes confirmed cultural content items to their `section` targets inside
// the rendered skeleton. Called AFTER the hero has been prepended but BEFORE
// injectStructured (so the hero-area items can be merged into the hero HTML).

import type { CulturalProfile, CulturalProfile as Profile } from "@/lib/types";
import {
  injectFAQCulturalItems,
  injectFooterCulturalItems,
  injectCustomCulturalSections,
  injectHeroEyebrow,
  injectHeroCtaArea,
  injectHeroDateArea,
  injectHeroNamesArea
} from "@/lib/cultural/sectionPlacement";

type ContentItem = Profile["contentItems"][number];

function groupBySection(items: ContentItem[]): Record<string, ContentItem[]> {
  const out: Record<string, ContentItem[]> = {};
  for (const item of items) {
    if (!item.included) continue;
    (out[item.section] ??= []).push(item);
  }
  return out;
}

export function injectCulturalContent(html: string, profile: CulturalProfile | null): string {
  if (!profile) return html;
  const grouped = groupBySection(profile.contentItems);

  let out = html;
  if (grouped.hero_eyebrow) out = injectHeroEyebrow(out, grouped.hero_eyebrow, profile);
  if (grouped.hero_names_area)
    out = injectHeroNamesArea(out, grouped.hero_names_area, profile);
  if (grouped.hero_date_area)
    out = injectHeroDateArea(out, grouped.hero_date_area, profile);
  if (grouped.hero_cta_area) out = injectHeroCtaArea(out, grouped.hero_cta_area, profile);
  if (grouped.faq) out = injectFAQCulturalItems(out, grouped.faq, profile);
  if (grouped.footer) out = injectFooterCulturalItems(out, grouped.footer, profile);
  if (grouped.custom_section)
    out = injectCustomCulturalSections(out, grouped.custom_section, profile);

  return out;
}
