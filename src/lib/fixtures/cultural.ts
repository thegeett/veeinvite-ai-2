// Client-side fixture helpers for the cultural configurator UI.
// Mirrors plan §26 algorithms until Stream B exports real implementations.
// When src/lib/cultural/library.ts stops returning empty arrays,
// replace imports from this file with imports from there.

import library from "@/lib/cultural-content-library.json";
import type {
  ContentItemDefinition,
  CulturalContentLibrary,
  CulturalProfile,
  CultureDefinition,
  DisplayCeremony,
  SectionType
} from "@/lib/types";

const lib = library as unknown as CulturalContentLibrary;

export function listCultures(): CultureDefinition[] {
  return Object.values(lib.cultures);
}

export function getCulture(cultureId: string): CultureDefinition | null {
  return lib.cultures[cultureId] ?? null;
}

export function listUniversalContent(): ContentItemDefinition[] {
  return lib.universalContent.items;
}

/**
 * §26 `getCeremoniesForCouple` — produces the ordered display list for the configurator.
 * - sub-region's `selected` list first (pre-selected correctly)
 * - then default ceremonies not already in the sub-region list, shown unselected
 * - then sub-region `additional` items, shown unselected
 * If no sub-region: returns the culture's default list as-is.
 */
export function getCeremoniesForCouple(
  cultureId: string,
  subRegion?: string
): DisplayCeremony[] {
  const culture = lib.cultures[cultureId];
  if (!culture) return [];
  const defaultList = culture.ceremonies?.default ?? [];
  const subList = subRegion ? culture.ceremonies?.subRegions?.[subRegion] : undefined;

  if (!subList) {
    return defaultList.map((c) => ({
      id: c.id,
      name: c.name,
      defaultIncluded: c.defaultIncluded,
      optional: c.optional,
      description: c.description,
      note: c.note,
      displaySource: "default" as const
    }));
  }

  const selectedIds = new Set(subList.selected.map((s) => s.id));
  const result: DisplayCeremony[] = [];

  subList.selected.forEach((s) => {
    const base = defaultList.find((d) => d.id === s.id);
    result.push({
      id: s.id,
      name: s.name ?? base?.name ?? s.id,
      defaultIncluded: s.defaultIncluded,
      optional: base?.optional ?? true,
      description: s.description ?? base?.description ?? "",
      note: s.note,
      displaySource: "subregion" as const
    });
  });

  defaultList
    .filter((d) => !selectedIds.has(d.id))
    .forEach((d) =>
      result.push({
        id: d.id,
        name: d.name,
        defaultIncluded: false,
        optional: d.optional,
        description: d.description,
        note: d.note,
        availabilityNote: "Not traditional for this region — available to add",
        displaySource: "default" as const
      })
    );

  (subList.additional ?? [])
    .filter((a) => !selectedIds.has(a.id))
    .forEach((a) =>
      result.push({
        id: a.id,
        name: a.name,
        defaultIncluded: false,
        optional: true,
        description: a.description,
        displaySource: "additional" as const
      })
    );

  return result;
}

/**
 * §26 `buildCulturalProfile` — converts configurator output to the shape stored in DB.
 */
export function buildCulturalProfile(
  cultureId: string,
  subRegion: string | undefined,
  confirmedContentItemIds: string[],
  confirmedCeremonyIds: string[],
  contentValues: Record<string, string>
): CulturalProfile {
  const culture = lib.cultures[cultureId];
  if (!culture) {
    return {
      id: cultureId,
      displayName: cultureId,
      contentItems: [],
      ceremonies: [],
      designGuidance: "",
      copyTone: "",
      copyGuardrails: "",
      bilingualEnabled: false
    };
  }

  const subDef = subRegion ? culture.ceremonies?.subRegions?.[subRegion] : undefined;
  const confirmedCeremonySet = new Set(confirmedCeremonyIds);
  const ceremonies = getCeremoniesForCouple(cultureId, subRegion)
    .filter((c) => confirmedCeremonySet.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      included: true,
      date: undefined,
      time: undefined,
      venue: undefined,
      source: c.displaySource
    }));

  const contentItems = culture.contentItems
    .filter((item) => confirmedContentItemIds.includes(item.id))
    .map((item) => ({
      id: item.id,
      label: item.label,
      section: item.section,
      customSectionLabel: item.customSectionLabel,
      fields: item.fields,
      included: true,
      values: contentValues
    }));

  return {
    id: cultureId,
    subRegion,
    displayName: subRegion
      ? `${culture.displayName} — ${subRegion.replace(/_/g, " ")}`
      : culture.displayName,
    contentItems,
    ceremonies,
    designGuidance: culture.designGuidance,
    copyTone: culture.copyTone,
    copyGuardrails: culture.copyGuardrails ?? "",
    subRegionCopyNote: subDef?.copyNote ?? "",
    bilingualEnabled: false
  };
}

/**
 * Interfaith conflict detector — surfaces duplicate section slots when two cultures
 * contribute items that both target the same `SectionType` placeholder (e.g. both
 * Muslim and Hindu contributing a `hero_eyebrow` religious opening).
 * The UI shows the conflict; the couple decides.
 */
export type ConflictReport = {
  section: SectionType;
  items: Array<{ cultureId: string; itemId: string; label: string }>;
};

export function findConflicts(
  selections: Array<{
    cultureId: string;
    subRegion?: string;
    confirmedContentItemIds: string[];
  }>
): ConflictReport[] {
  const bySection = new Map<SectionType, { cultureId: string; itemId: string; label: string }[]>();

  selections.forEach((sel) => {
    const culture = lib.cultures[sel.cultureId];
    if (!culture) return;
    culture.contentItems
      .filter((item) => sel.confirmedContentItemIds.includes(item.id))
      .forEach((item) => {
        const list = bySection.get(item.section) ?? [];
        list.push({ cultureId: sel.cultureId, itemId: item.id, label: item.label });
        bySection.set(item.section, list);
      });
  });

  const conflicts: ConflictReport[] = [];
  bySection.forEach((items, section) => {
    const cultures = new Set(items.map((i) => i.cultureId));
    if (cultures.size >= 2 && (section === "hero_eyebrow" || section === "hero_names_area")) {
      conflicts.push({ section, items });
    }
  });
  return conflicts;
}
