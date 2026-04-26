// Cultural content library loader + algorithms — plan §26.
//
// All culture-aware code funnels through this module. Never read the JSON
// directly elsewhere — always call these exports.
//
//   - loadLibrary: validates JSON shape and returns a typed view.
//   - getCeremoniesForCouple: default + sub-region override + additional,
//     preserving displaySource so the UI can tell pre-selected from available.
//   - buildCulturalProfile: assembles the confirmed profile object from quiz
//     input.
//   - buildCulturalPromptBlock: the prompt fragment injected into Call 2 /
//     Call 3. Includes HARD RULES from copyGuardrails.
//   - findConflicts: surfaces duplicate section slots across interfaith
//     profiles (never auto-resolves — operator-facing).

import libraryJson from "@/lib/cultural-content-library.json";
import type {
  CeremonyDefinition,
  CulturalConflict,
  CulturalContentLibrary,
  CulturalProfile,
  CultureDefinition,
  CultureSelection,
  DisplayCeremony,
  FieldDefinition,
  SubRegionCeremonies
} from "@/lib/types";

type Library = CulturalContentLibrary;

// ---------- Loader ---------------------------------------------------------

let cachedLibrary: Library | null = null;

export function loadLibrary(): Library {
  if (cachedLibrary) return cachedLibrary;
  const lib = libraryJson as unknown as Library;
  validateLibraryShape(lib);
  cachedLibrary = lib;
  return lib;
}

function validateLibraryShape(lib: Library): void {
  if (!lib || typeof lib !== "object") {
    throw new Error("cultural-content-library.json is not an object");
  }
  if (!lib.cultures || typeof lib.cultures !== "object") {
    throw new Error("library.cultures is missing");
  }
  // Smoke-check a couple of required cultures that tests and downstream
  // streams rely on.
  const required = ["hindu_indian", "western"];
  for (const id of required) {
    if (!lib.cultures[id]) {
      throw new Error(`library.cultures["${id}"] is required but missing`);
    }
  }
}

export function getCulture(cultureId: string): CultureDefinition | undefined {
  return loadLibrary().cultures[cultureId];
}

// ---------- Ceremony algorithm (plan §26 verbatim) -------------------------

export function getCeremoniesForCouple(
  cultureId: string,
  subRegion?: string
): DisplayCeremony[] {
  const culture = getCulture(cultureId);
  if (!culture) return [];
  const defaultList = culture.ceremonies.default ?? [];

  const sub = subRegion ? culture.ceremonies.subRegions?.[subRegion] : undefined;

  if (!sub) {
    return defaultList.map((c: CeremonyDefinition) => ({
      id: c.id,
      name: c.name,
      defaultIncluded: c.defaultIncluded,
      optional: c.optional,
      description: c.description,
      note: c.note,
      displaySource: "default" as const
    }));
  }

  const selectedIds = new Set(sub.selected.map((c) => c.id));
  const result: DisplayCeremony[] = [];

  // Step 1 — sub-region's own pre-selected list.
  for (const s of sub.selected) {
    const base = defaultList.find((d: CeremonyDefinition) => d.id === s.id);
    result.push({
      id: s.id,
      name: s.name ?? base?.name ?? s.id,
      defaultIncluded: s.defaultIncluded,
      optional: base?.optional ?? true,
      description: s.description ?? base?.description ?? "",
      note: s.note,
      displaySource: "subregion"
    });
  }

  // Step 2 — default ceremonies not already in the sub-region list.
  for (const d of defaultList) {
    if (selectedIds.has(d.id)) continue;
    result.push({
      id: d.id,
      name: d.name,
      defaultIncluded: false,
      optional: true,
      description: d.description,
      note: d.note,
      availabilityNote: "Not traditional for this region — available to add",
      displaySource: "default"
    });
  }

  // Step 3 — sub-region specific additional ceremonies.
  for (const a of sub.additional ?? []) {
    if (selectedIds.has(a.id)) continue;
    result.push({
      id: a.id,
      name: a.name,
      defaultIncluded: false,
      optional: true,
      description: a.description,
      displaySource: "additional"
    });
  }

  return result;
}

// ---------- Profile assembly ----------------------------------------------

export function buildCulturalProfile(
  cultureId: string,
  subRegion: string | undefined,
  confirmedContentItemIds: string[],
  confirmedCeremonyIds: string[],
  contentValues: Record<string, string>,
  bilingual?: {
    enabled: boolean;
    language?: "zh" | "ar" | "he";
    direction?: "ltr" | "rtl";
    fields?: Record<string, string>;
  }
): CulturalProfile {
  const def = getCulture(cultureId);
  if (!def) {
    return {
      id: cultureId,
      displayName: cultureId,
      contentItems: [],
      ceremonies: [],
      designGuidance: "",
      copyTone: "",
      copyGuardrails: "",
      bilingualEnabled: bilingual?.enabled ?? false,
      bilingualLanguage: bilingual?.language,
      bilingualDirection: bilingual?.direction,
      bilingualFields: bilingual?.fields
    };
  }

  const subDef: SubRegionCeremonies | undefined = subRegion
    ? def.ceremonies.subRegions?.[subRegion]
    : undefined;

  const displayName = subRegion ? `${def.displayName} — ${subRegion}` : def.displayName;

  const contentItems = def.contentItems
    .filter((item) => confirmedContentItemIds.includes(item.id))
    .map((item) => ({
      id: item.id,
      label: item.label,
      section: item.section,
      customSectionLabel: item.customSectionLabel,
      fields: item.fields as FieldDefinition[],
      included: true,
      values: extractItemValues(item.fields, contentValues)
    }));

  const ceremonyDisplay = getCeremoniesForCouple(cultureId, subRegion);
  const ceremonies = ceremonyDisplay
    .filter((c) => confirmedCeremonyIds.includes(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      included: true,
      date: undefined,
      time: undefined,
      venue: undefined,
      source: c.displaySource
    }));

  return {
    id: cultureId,
    subRegion,
    displayName,
    contentItems,
    ceremonies,
    designGuidance: def.designGuidance,
    copyTone: def.copyTone,
    copyGuardrails: def.copyGuardrails ?? "",
    subRegionCopyNote: subDef?.copyNote,
    bilingualEnabled: bilingual?.enabled ?? false,
    bilingualLanguage: bilingual?.language,
    bilingualDirection: bilingual?.direction,
    bilingualFields: bilingual?.fields
  };
}

// Interfaith merge — the configurator UI lets a couple add more than one
// culture. The renderer + AI prompts work off a single CulturalProfile, so
// we collapse the list here. Strategy:
//   - Primary (selections[0]) wins for the scalar / design fields. The site
//     has one visual identity (CLAUDE.md §5) and one design voice; the
//     couple's first pick is treated as the lead.
//   - copyGuardrails are HARD constraints (CLAUDE.md §26). Both cultures'
//     rules must apply, so they are concatenated.
//   - contentItems and ceremonies are merged across all selections,
//     deduplicated by id (first occurrence wins).
export function buildMergedCulturalProfile(
  selections: CultureSelection[],
  contentValues: Record<string, string>,
  bilingual?: {
    enabled: boolean;
    language?: "zh" | "ar" | "he";
    direction?: "ltr" | "rtl";
    fields?: Record<string, string>;
  }
): CulturalProfile | null {
  if (selections.length === 0) return null;

  const profiles = selections.map((s) =>
    buildCulturalProfile(
      s.cultureId,
      s.subRegion,
      s.confirmedContentItemIds,
      s.confirmedCeremonyIds,
      contentValues,
      bilingual
    )
  );

  if (profiles.length === 1) return profiles[0];

  const primary = profiles[0];

  const seenItemIds = new Set<string>();
  const mergedItems: CulturalProfile["contentItems"] = [];
  for (const p of profiles) {
    for (const item of p.contentItems) {
      if (seenItemIds.has(item.id)) continue;
      seenItemIds.add(item.id);
      mergedItems.push(item);
    }
  }

  const seenCeremonyIds = new Set<string>();
  const mergedCeremonies: CulturalProfile["ceremonies"] = [];
  for (const p of profiles) {
    for (const c of p.ceremonies) {
      if (seenCeremonyIds.has(c.id)) continue;
      seenCeremonyIds.add(c.id);
      mergedCeremonies.push(c);
    }
  }

  const guardrails = profiles
    .map((p) => p.copyGuardrails)
    .filter((g) => g.length > 0);
  const seenGuardrails = new Set<string>();
  const dedupedGuardrails = guardrails.filter((g) => {
    if (seenGuardrails.has(g)) return false;
    seenGuardrails.add(g);
    return true;
  });

  return {
    ...primary,
    contentItems: mergedItems,
    ceremonies: mergedCeremonies,
    copyGuardrails: dedupedGuardrails.join("\n\n")
  };
}

function extractItemValues(
  fields: FieldDefinition[],
  all: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (all[f.key] !== undefined) out[f.key] = all[f.key];
  }
  return out;
}

// ---------- Prompt block (plan §26 verbatim structure) --------------------

export function buildCulturalPromptBlock(profile: CulturalProfile | null): string {
  if (!profile || !profile.id || profile.id === "western") return "";
  const guardrails = profile.copyGuardrails?.trim() || "(none specific)";
  const subNote = profile.subRegionCopyNote?.trim()
    ? `\nSub-region specific rules:\n${profile.subRegionCopyNote.trim()}`
    : "";
  const ceremoniesList = profile.ceremonies
    .filter((c) => c.included)
    .map((c) => `  - ${c.name}`)
    .join("\n");
  return `CULTURAL CONTEXT:
Culture: ${profile.displayName}

Design guidance:
${profile.designGuidance}

Copy tone:
${profile.copyTone}

COPY GUARDRAILS — READ BEFORE GENERATING ANY TEXT:
${guardrails}${subNote}

Ceremonies included (use these exact names):
${ceremoniesList || "  (none specified)"}`.trim();
}

// ---------- Conflict detection (interfaith) -------------------------------

export function findConflicts(profiles: CulturalProfile[]): CulturalConflict[] {
  type SectionKey = CulturalProfile["contentItems"][number]["section"];
  const slots = new Map<SectionKey, Array<{ cultureId: string; itemId: string; label: string }>>();
  for (const profile of profiles) {
    for (const item of profile.contentItems) {
      if (!item.included) continue;
      const bucket = slots.get(item.section) ?? [];
      bucket.push({ cultureId: profile.id, itemId: item.id, label: item.label });
      slots.set(item.section, bucket);
    }
  }
  const singularSlots: ReadonlySet<SectionKey> = new Set<SectionKey>([
    "hero_eyebrow",
    "hero_cta_area"
  ]);
  const conflicts: CulturalConflict[] = [];
  for (const [section, items] of slots) {
    if (!singularSlots.has(section)) continue;
    if (items.length < 2) continue;
    const cultures = new Set(items.map((i) => i.cultureId));
    if (cultures.size < 2) continue;
    conflicts.push({
      section,
      items,
      kind: "duplicate_section_slot"
    });
  }
  return conflicts;
}
