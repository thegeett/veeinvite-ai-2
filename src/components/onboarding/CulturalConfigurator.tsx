"use client";

import { useMemo } from "react";
import {
  ConflictReport,
  findConflicts,
  getCeremoniesForCouple,
  getCulture,
  listCultures,
  listUniversalContent
} from "@/lib/fixtures/cultural";

export type CultureSelection = {
  cultureId: string;
  subRegion?: string;
  confirmedContentItemIds: string[];
  confirmedCeremonyIds: string[];
};

type Props = {
  selections: CultureSelection[];
  onChange: (selections: CultureSelection[]) => void;
};

export function CulturalConfigurator({ selections, onChange }: Props) {
  const cultures = listCultures();
  const universal = listUniversalContent();
  const conflicts = useMemo(() => findConflicts(selections), [selections]);

  function toggleCulture(cultureId: string) {
    const existing = selections.find((s) => s.cultureId === cultureId);
    if (existing) {
      onChange(selections.filter((s) => s.cultureId !== cultureId));
      return;
    }
    const culture = getCulture(cultureId);
    if (!culture) return;
    const defaultContentIds = culture.contentItems
      .filter((i) => i.defaultIncluded)
      .map((i) => i.id);
    const ceremonies = getCeremoniesForCouple(cultureId, undefined);
    const defaultCeremonyIds = ceremonies.filter((c) => c.defaultIncluded).map((c) => c.id);
    onChange([
      ...selections,
      {
        cultureId,
        subRegion: undefined,
        confirmedContentItemIds: defaultContentIds,
        confirmedCeremonyIds: defaultCeremonyIds
      }
    ]);
  }

  function setSubRegion(cultureId: string, subRegion: string | undefined) {
    onChange(
      selections.map((s) => {
        if (s.cultureId !== cultureId) return s;
        const ceremonies = getCeremoniesForCouple(cultureId, subRegion);
        const defaultCeremonyIds = ceremonies.filter((c) => c.defaultIncluded).map((c) => c.id);
        return { ...s, subRegion, confirmedCeremonyIds: defaultCeremonyIds };
      })
    );
  }

  function toggleContentItem(cultureId: string, itemId: string) {
    onChange(
      selections.map((s) => {
        if (s.cultureId !== cultureId) return s;
        const has = s.confirmedContentItemIds.includes(itemId);
        return {
          ...s,
          confirmedContentItemIds: has
            ? s.confirmedContentItemIds.filter((id) => id !== itemId)
            : [...s.confirmedContentItemIds, itemId]
        };
      })
    );
  }

  function toggleCeremony(cultureId: string, ceremonyId: string) {
    onChange(
      selections.map((s) => {
        if (s.cultureId !== cultureId) return s;
        const has = s.confirmedCeremonyIds.includes(ceremonyId);
        return {
          ...s,
          confirmedCeremonyIds: has
            ? s.confirmedCeremonyIds.filter((id) => id !== ceremonyId)
            : [...s.confirmedCeremonyIds, ceremonyId]
        };
      })
    );
  }

  function resolveConflict(conflict: ConflictReport, keptCultureId: string) {
    onChange(
      selections.map((s) => {
        const conflictingItem = conflict.items.find((i) => i.cultureId === s.cultureId);
        if (!conflictingItem) return s;
        if (s.cultureId === keptCultureId) return s;
        return {
          ...s,
          confirmedContentItemIds: s.confirmedContentItemIds.filter(
            (id) => id !== conflictingItem.itemId
          )
        };
      })
    );
  }

  return (
    <div className="space-y-10">
      {/* Culture multi-select */}
      <section>
        <h3 className="font-serif text-2xl mb-1">Your traditions</h3>
        <p className="text-ink/70 text-sm mb-5">
          Pick one, or several — interfaith weddings are handled. Your choice shapes
          ceremonies, copy, and the little cultural details.
        </p>
        <div className="flex flex-wrap gap-2">
          {cultures.map((c) => {
            const active = selections.some((s) => s.cultureId === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCulture(c.id)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? "border-ink bg-ink text-canvas"
                    : "border-line bg-paper text-ink hover:border-ink/50"
                }`}
              >
                {c.displayName}
              </button>
            );
          })}
        </div>
      </section>

      {/* Interfaith conflicts */}
      {conflicts.length > 0 ? (
        <section className="rounded-md border border-blush/40 bg-blush/5 p-5">
          <div className="veein-meta mb-2 text-blush">⚠ Interfaith details to resolve</div>
          {conflicts.map((conflict, idx) => (
            <div key={idx} className="mb-4 last:mb-0">
              <p className="font-serif text-lg leading-snug mb-3">
                Two traditions want to sit in the{" "}
                <span className="italic">{sectionLabel(conflict.section)}</span>. Which one
                leads?
              </p>
              <div className="flex flex-wrap gap-2">
                {conflict.items.map((item) => {
                  const name = getCulture(item.cultureId)?.displayName ?? item.cultureId;
                  return (
                    <button
                      key={item.itemId}
                      type="button"
                      onClick={() => resolveConflict(conflict, item.cultureId)}
                      className="rounded-full border border-ink bg-canvas px-4 py-2 text-sm hover:bg-ink hover:text-canvas transition-colors"
                    >
                      Keep {item.label} ({name})
                    </button>
                  );
                })}
                <span className="text-sm text-ink/60 self-center">
                  or keep both — they’ll appear in order of selection.
                </span>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* Per-culture configurators */}
      {selections.map((sel) => (
        <CultureBlock
          key={sel.cultureId}
          selection={sel}
          onToggleContent={(id) => toggleContentItem(sel.cultureId, id)}
          onToggleCeremony={(id) => toggleCeremony(sel.cultureId, id)}
          onSubRegion={(sr) => setSubRegion(sel.cultureId, sr)}
        />
      ))}

      {/* Universal content */}
      {selections.length > 0 ? (
        <section>
          <h3 className="font-serif text-2xl mb-1">Guest essentials</h3>
          <p className="text-ink/70 text-sm mb-5">
            Available to any wedding. Add what applies.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {universal.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-line bg-paper p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-serif text-base">{item.label}</div>
                    <div className="text-ink/60 text-sm mt-1">{item.description}</div>
                  </div>
                  <span className="veein-meta text-stone whitespace-nowrap">
                    Optional
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CultureBlock({
  selection,
  onToggleContent,
  onToggleCeremony,
  onSubRegion
}: {
  selection: CultureSelection;
  onToggleContent: (id: string) => void;
  onToggleCeremony: (id: string) => void;
  onSubRegion: (sr: string | undefined) => void;
}) {
  const ceremonies = useMemo(
    () => getCeremoniesForCouple(selection.cultureId, selection.subRegion),
    [selection.cultureId, selection.subRegion]
  );

  const culture = getCulture(selection.cultureId);
  if (!culture) return null;

  const alsoAvailable = ceremonies.filter(
    (c) => !selection.confirmedCeremonyIds.includes(c.id)
  );
  const confirmedCeremonies = ceremonies.filter((c) =>
    selection.confirmedCeremonyIds.includes(c.id)
  );

  return (
    <section className="border-t border-line pt-10">
      <div className="flex items-baseline justify-between flex-wrap gap-4 mb-6">
        <h3 className="font-serif text-2xl">{culture.displayName}</h3>
        {culture.subRegions && culture.subRegions.length > 0 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="veein-meta text-stone">Sub-region</span>
            <select
              value={selection.subRegion ?? ""}
              onChange={(e) => onSubRegion(e.target.value || undefined)}
              className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm"
            >
              <option value="">—</option>
              {culture.subRegions.map((sr) => (
                <option key={sr} value={sr}>
                  {sr.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {/* Content items */}
      {culture.contentItems.length > 0 ? (
        <div className="mb-8">
          <div className="veein-meta mb-3 text-stone">Your content</div>
          <ul className="grid gap-2">
            {culture.contentItems.map((item) => {
              const on = selection.confirmedContentItemIds.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onToggleContent(item.id)}
                    className={`group w-full text-left rounded-md border px-4 py-3 transition-colors ${
                      on
                        ? "border-ink bg-paper"
                        : "border-line bg-canvas text-ink/60 hover:border-ink/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-serif text-base">
                          {on ? "✓ " : "+ "}
                          {item.label}
                        </div>
                        <div className="text-sm mt-0.5">{item.description}</div>
                        {item.displayNote ? (
                          <div className="veein-meta text-stone mt-1">{item.displayNote}</div>
                        ) : null}
                      </div>
                      <span className="veein-meta text-stone whitespace-nowrap">
                        {sectionLabel(item.section)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Ceremonies */}
      <div>
        <div className="veein-meta mb-3 text-stone">Your ceremonies</div>
        <ul className="grid gap-2">
          {confirmedCeremonies.map((c) => (
            <CeremonyRow
              key={c.id}
              ceremony={c}
              active={true}
              onToggle={() => onToggleCeremony(c.id)}
            />
          ))}
        </ul>
        {alsoAvailable.length > 0 ? (
          <>
            <div className="veein-meta mt-6 mb-3 text-stone">
              Also available {selection.subRegion ? `— not traditional for ${selection.subRegion.replace(/_/g, " ")}, but available to add` : ""}
            </div>
            <ul className="grid gap-2">
              {alsoAvailable.map((c) => (
                <CeremonyRow
                  key={c.id}
                  ceremony={c}
                  active={false}
                  onToggle={() => onToggleCeremony(c.id)}
                />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}

function CeremonyRow({
  ceremony,
  active,
  onToggle
}: {
  ceremony: { id: string; name: string; description: string; note?: string };
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${
          active
            ? "border-ink bg-paper"
            : "border-line bg-canvas text-ink/60 hover:border-ink/40"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-serif text-base">
              {active ? "✓ " : "+ "}
              {ceremony.name}
            </div>
            {ceremony.description ? (
              <div className="text-sm mt-0.5">{ceremony.description}</div>
            ) : null}
            {ceremony.note ? (
              <div className="veein-meta text-stone mt-1">{ceremony.note}</div>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}

function sectionLabel(section: string): string {
  const m: Record<string, string> = {
    hero_eyebrow: "Hero opening",
    hero_names_area: "Near the names",
    hero_date_area: "Near the date",
    hero_cta_area: "Near RSVP",
    story: "Story",
    events: "Events",
    rsvp: "RSVP",
    gallery: "Gallery",
    faq: "FAQ",
    custom_section: "New section",
    footer: "Footer"
  };
  return m[section] ?? section;
}
