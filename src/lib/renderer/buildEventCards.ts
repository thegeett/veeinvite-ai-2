// buildEventCards — plan §26.
//
// Produces the HTML fragment that replaces `{{EVENTS_CARDS}}` in skeletons.
// Events are sourced primarily from `culturalProfile.ceremonies` (confirmed +
// included). When no cultural profile is present, falls back to EventData rows
// passed by the caller — the pipeline orchestrator merges DB events into this
// path for Western / no-culture flows.

import type { CulturalProfile, EventData, ThemeJSON } from "@/lib/types";

interface BuildEventCardsInput {
  profile: CulturalProfile | null;
  events: EventData[];
  // theme_json reserved for future per-culture styling hints
  themeJson?: ThemeJSON;
}

const NUMBER_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine"
];

function numberWord(index: number): string {
  return NUMBER_WORDS[index] ?? String(index + 1);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildEventCards(input: BuildEventCardsInput): string {
  const confirmed =
    input.profile?.ceremonies.filter((c) => c.included) ?? [];

  type Row = {
    name: string;
    time: string;
    venue: string;
  };

  const rows: Row[] = [];

  if (confirmed.length > 0) {
    // Match confirmed ceremonies to EventData by id-or-name where possible
    // to inherit the couple's filled-in date/time/venue.
    for (const ceremony of confirmed) {
      const match = input.events.find(
        (e) =>
          e.event_type === ceremony.id ||
          e.name.toLowerCase() === ceremony.name.toLowerCase()
      );
      rows.push({
        name: ceremony.name,
        time:
          match?.event_time ||
          ceremony.time ||
          ceremony.date ||
          match?.event_date ||
          "Time to be announced",
        venue: match?.venue || ceremony.venue || "Venue to be announced"
      });
    }
  } else if (input.events.length > 0) {
    for (const e of input.events) {
      rows.push({
        name: e.name,
        time: e.event_time || e.event_date || "Time to be announced",
        venue: e.venue || "Venue to be announced"
      });
    }
  }

  // Clamp to max 6 per §26 "Maximum 6 ceremony slots".
  return rows
    .slice(0, 6)
    .map((row, index) => {
      const delay = Math.min(index + 1, 3);
      return `<div class="event-card reveal reveal-d${delay}">
  <div class="event-number">${escapeHtml(numberWord(index))}</div>
  <h3 class="event-name">${escapeHtml(row.name)}</h3>
  <div class="event-detail">
    <span class="event-detail-icon">🕐</span>
    <span>${escapeHtml(row.time)}</span>
  </div>
  <div class="event-detail">
    <span class="event-detail-icon">📍</span>
    <span>${escapeHtml(row.venue)}</span>
  </div>
</div>`;
    })
    .join("\n");
}
