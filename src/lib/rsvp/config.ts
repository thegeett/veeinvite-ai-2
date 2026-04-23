// RSVP config + form builder — plan §29.
//
// RSVP form structure is NEVER AI-generated (architecture rule 9). It's
// rendered from a typed config at render time. Smart defaults per cultural
// profile (§29 table) seed the config when the couple first lands on step 2.

import type { CulturalProfile, EventData, RSVPConfig } from "@/lib/types";

const BASE_DEFAULTS: RSVPConfig = {
  guestCountEnabled: true,
  guestCountMax: 4,
  childrenSeparate: false,
  childrenMax: 5,
  plusOneEnabled: false,
  eventSelectionEnabled: false,
  mealChoiceEnabled: false,
  mealOptions: [],
  dietaryEnabled: true,
  messageEnabled: true,
  songRequestEnabled: false
};

/**
 * Returns the starting RSVP config given a cultural profile. Couples can
 * override any field in the dashboard — this is *defaults only*.
 * See plan §29 table.
 */
export function smartDefaultsForProfile(
  profile: CulturalProfile | null | undefined,
  eventCount: number = 0
): RSVPConfig {
  const cfg: RSVPConfig = { ...BASE_DEFAULTS };

  if (profile) {
    switch (profile.id) {
      case "hindu_indian":
        cfg.guestCountMax = 10;
        cfg.childrenSeparate = true;
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
      case "sikh":
        cfg.guestCountMax = 10;
        cfg.childrenSeparate = true;
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
      case "muslim":
        cfg.guestCountMax = 8;
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
      case "jewish":
        cfg.guestCountMax = 6;
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
      case "nigerian_yoruba":
      case "nigerian_igbo":
        cfg.guestCountMax = 10;
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
      case "chinese":
        cfg.guestCountMax = 8;
        cfg.mealChoiceEnabled = true;
        cfg.mealOptions = ["Standard", "Vegetarian"];
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
      case "latin_american_catholic":
        cfg.guestCountMax = 8;
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
      case "western":
      default:
        cfg.guestCountMax = 4;
        cfg.eventSelectionEnabled = eventCount >= 2;
        break;
    }
  } else {
    cfg.eventSelectionEnabled = eventCount >= 2;
  }

  return cfg;
}

// ---------- Form renderer --------------------------------------------------

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns the HTML fragment that replaces `{{RSVP_FORM}}` inside the skeleton.
 * Matches the skeleton's class names so Call 2's CSS selectors hit correctly.
 */
export function buildRSVPForm(config: RSVPConfig, events: EventData[]): string {
  const guestCountMax = Math.max(1, config.guestCountMax || 1);
  const guestOptions = Array.from({ length: guestCountMax }, (_, i) => i + 1)
    .map((n) => `<option value="${n}">${n}</option>`)
    .join("");
  const childOptions = Array.from({ length: (config.childrenMax ?? 5) + 1 }, (_, i) => i)
    .map((n) => `<option value="${n}">${n}</option>`)
    .join("");

  const pieces: string[] = [];

  pieces.push(`<form id="rsvp-form" class="rsvp-form" method="post" action="/api/rsvp">`);
  pieces.push(`<div class="form-row">
  <div class="form-field">
    <label for="rsvp-first-name">First name</label>
    <input id="rsvp-first-name" name="first_name" type="text" required>
  </div>
  <div class="form-field">
    <label for="rsvp-last-name">Last name</label>
    <input id="rsvp-last-name" name="last_name" type="text" required>
  </div>
</div>`);
  pieces.push(`<div class="form-field">
  <label for="rsvp-email">Email</label>
  <input id="rsvp-email" name="email" type="email" required>
</div>`);

  pieces.push(`<div class="form-field">
  <span class="form-label">Will you be attending?</span>
  <div class="rsvp-options">
    <div class="rsvp-option">
      <input id="rsvp-accept" name="attending" type="radio" value="true" required>
      <label for="rsvp-accept">{{RSVP_ACCEPT_LABEL}}</label>
    </div>
    <div class="rsvp-option">
      <input id="rsvp-decline" name="attending" type="radio" value="false">
      <label for="rsvp-decline">{{RSVP_DECLINE_LABEL}}</label>
    </div>
  </div>
</div>`);

  if (config.guestCountEnabled) {
    pieces.push(`<div class="form-field">
  <label for="rsvp-guest-count">Number of guests (including you)</label>
  <select id="rsvp-guest-count" name="guest_count">${guestOptions}</select>
</div>`);
  }

  if (config.childrenSeparate) {
    pieces.push(`<div class="form-field">
  <label for="rsvp-child-count">Children in your party</label>
  <select id="rsvp-child-count" name="children_count">${childOptions}</select>
</div>`);
  }

  if (config.plusOneEnabled) {
    pieces.push(`<div class="form-field">
  <label for="rsvp-plus-one">Plus-one name (if applicable)</label>
  <input id="rsvp-plus-one" name="plus_one_name" type="text">
</div>`);
  }

  if (config.eventSelectionEnabled && events.length >= 2) {
    const items = events
      .map((e, i) => {
        const id = `rsvp-event-${esc(e.id || String(i))}`;
        const value = esc(e.id || e.name);
        const label = esc(e.name);
        return `<label class="rsvp-event-option" for="${id}">
  <input id="${id}" name="events_attending" type="checkbox" value="${value}">
  <span>${label}</span>
</label>`;
      })
      .join("\n");
    pieces.push(`<div class="form-field">
  <span class="form-label">Which events will you join?</span>
  <div class="rsvp-events-list">${items}</div>
</div>`);
  }

  if (config.mealChoiceEnabled && config.mealOptions?.length) {
    const options = config.mealOptions
      .map((m) => `<option value="${esc(m)}">${esc(m)}</option>`)
      .join("");
    pieces.push(`<div class="form-field">
  <label for="rsvp-meal">Meal choice</label>
  <select id="rsvp-meal" name="meal_choice">
    <option value="">Please choose</option>
    ${options}
  </select>
</div>`);
  }

  if (config.dietaryEnabled) {
    pieces.push(`<div class="form-field">
  <label for="rsvp-dietary">Dietary requirements or allergies</label>
  <input id="rsvp-dietary" name="dietary" type="text">
</div>`);
  }

  if (config.songRequestEnabled) {
    pieces.push(`<div class="form-field">
  <label for="rsvp-song">Song request</label>
  <input id="rsvp-song" name="song_request" type="text">
</div>`);
  }

  if (config.messageEnabled) {
    pieces.push(`<div class="form-field">
  <label for="rsvp-message">A message for the couple</label>
  <textarea id="rsvp-message" name="message" rows="4"></textarea>
</div>`);
  }

  pieces.push(`<button class="rsvp-submit" type="submit">{{RSVP_SUBMIT_LABEL}}</button>`);
  pieces.push(`</form>`);

  return pieces.join("\n");
}
