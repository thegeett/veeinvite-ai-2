// Renders a full invitation for Priya & Arjun using the REAL renderer with
// authored Call 2 + Call 3 outputs. No Anthropic calls — the Call 2/Call 3
// outputs below are what Claude would return for this couple given our prompts.
// Saves the result to /tmp/priya-arjun-invitation.html for inspection.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@/lib/renderer";
import { smartDefaultsForProfile } from "@/lib/rsvp/config";
import type { CoupleData, EventData, LayoutId, RenderInput, ThemeJSON } from "@/lib/types";

// ---------- Couple input (as provided) ------------------------------------

const COUPLE: CoupleData = {
  id: "priya-arjun-demo",
  user_id: "demo-user",
  slug: "priya-and-arjun",
  person1_name: "Priya",
  person2_name: "Arjun",
  wedding_date: "Friday, 1 May 2026",
  wedding_date_iso: "2026-05-01T16:00:00Z",
  venue_name: "The Leela Palace",
  venue_city: "Udaipur",
  rsvp_deadline: null,
  style: null,
  vibe: null,
  story: "We met at a friend's party in 2026.",
  cultural_context: null,
  layout_id: "layout-1",
  cultural_profile: null,
  rsvp_config: null,
  global_tokens: null,
  theme_json: null,
  hero_html: null,
  design_summary: null,
  custom_sections: [],
  photo_urls: [],
  site_html_url: null,
  is_published: false,
  created_at: "",
  updated_at: ""
};

// Western default — no style card, no culture selected. Warm cream + burgundy
// rose + muted gold. Romantic but restrained, reads well in serif + body.

const THEME_JSON: ThemeJSON = {
  globalTokens: {
    bgPrimary: "#F7F2EA",
    bgSecondary: "#EDE3D3",
    bgCard: "#FFFFFF",
    accent: "#8B2E3F",
    accentLight: "#C87482",
    gold: "#B89965",
    textPrimary: "#2A1E1C",
    textMuted: "rgba(42,30,28,0.58)",
    textSubtle: "rgba(42,30,28,0.32)",
    fontDisplay: "Great Vibes",
    fontHeading: "Cormorant Garamond",
    fontBody: "Jost"
  },
  styles: {
    "body": {
      background: "#F7F2EA",
      color: "#2A1E1C",
      "font-family": "'Jost', sans-serif"
    },
    "nav": {
      background: "rgba(247,242,234,0.88)",
      color: "#2A1E1C",
      "border-bottom": "1px solid rgba(184,153,101,0.25)",
      "backdrop-filter": "blur(8px)"
    },
    ".nav-monogram": {
      "font-family": "'Great Vibes', cursive",
      "font-size": "1.6rem",
      color: "#8B2E3F"
    },
    ".nav-link": {
      color: "rgba(42,30,28,0.72)",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.78rem",
      "letter-spacing": "0.14em",
      "text-transform": "uppercase"
    },
    ".story": { background: "#F7F2EA" },
    ".story-photo": { background: "#EDE3D3", "border-radius": "2px" },
    ".story-photo-placeholder": { color: "rgba(42,30,28,0.3)", "font-family": "'Cormorant Garamond', serif" },
    ".story-eyebrow": {
      color: "#B89965",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.72rem",
      "letter-spacing": "0.3em",
      "text-transform": "uppercase"
    },
    ".story-script": {
      "font-family": "'Great Vibes', cursive",
      color: "#8B2E3F",
      "font-size": "clamp(3rem, 7vw, 4.5rem)"
    },
    ".story-heading": {
      "font-family": "'Cormorant Garamond', serif",
      "font-size": "clamp(2rem, 5vw, 3.2rem)",
      "font-weight": "400",
      color: "#2A1E1C",
      "line-height": "1.15"
    },
    ".story-body": {
      "font-family": "'Jost', sans-serif",
      color: "rgba(42,30,28,0.78)",
      "font-size": "1.02rem",
      "line-height": "1.75"
    },
    ".story-quote": {
      "font-family": "'Cormorant Garamond', serif",
      "font-style": "italic",
      color: "#8B2E3F",
      "font-size": "1.3rem",
      "border-left": "2px solid #B89965",
      "padding-left": "1.5rem"
    },
    ".events": { background: "#EDE3D3" },
    ".events-eyebrow": {
      color: "#B89965",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.72rem",
      "letter-spacing": "0.3em",
      "text-transform": "uppercase",
      "text-align": "center"
    },
    ".events-heading": {
      "font-family": "'Cormorant Garamond', serif",
      "font-size": "clamp(2rem, 5vw, 3rem)",
      "font-weight": "400",
      color: "#2A1E1C",
      "text-align": "center"
    },
    ".events-grid": { "margin-top": "3rem" },
    ".event-card": {
      background: "#FFFFFF",
      color: "#2A1E1C",
      "border": "1px solid rgba(184,153,101,0.22)",
      "border-radius": "2px",
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      "box-shadow": "0 1px 3px rgba(42,30,28,0.04)"
    },
    ".event-number": {
      "font-family": "'Great Vibes', cursive",
      color: "#8B2E3F",
      "font-size": "3.8rem",
      opacity: "0.14"
    },
    ".event-name": {
      "font-family": "'Cormorant Garamond', serif",
      "font-size": "1.5rem",
      "font-weight": "500",
      color: "#2A1E1C",
      "margin-bottom": "1rem"
    },
    ".event-detail": {
      color: "rgba(42,30,28,0.68)",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.92rem"
    },
    ".rsvp": { background: "#F7F2EA" },
    ".rsvp-eyebrow": {
      color: "#B89965",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.72rem",
      "letter-spacing": "0.3em",
      "text-transform": "uppercase"
    },
    ".rsvp-heading": {
      "font-family": "'Cormorant Garamond', serif",
      "font-size": "clamp(2rem, 5vw, 3rem)",
      "font-weight": "400",
      color: "#2A1E1C"
    },
    ".rsvp-sub": {
      color: "rgba(42,30,28,0.66)",
      "font-family": "'Jost', sans-serif",
      "font-size": "1rem"
    },
    ".form-field label": {
      color: "rgba(42,30,28,0.72)",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.82rem",
      "letter-spacing": "0.05em"
    },
    ".form-field input, .form-field select, .form-field textarea": {
      background: "#FFFFFF",
      color: "#2A1E1C",
      "border": "1px solid rgba(42,30,28,0.18)",
      "border-radius": "2px",
      "font-family": "'Jost', sans-serif"
    },
    ".rsvp-option label": {
      background: "#FFFFFF",
      color: "#2A1E1C",
      "border": "1px solid rgba(42,30,28,0.18)",
      "border-radius": "2px",
      transition: "all 0.2s"
    },
    ".rsvp-option input:checked + label": {
      background: "#8B2E3F",
      color: "#F7F2EA",
      "border-color": "#8B2E3F"
    },
    ".rsvp-submit": {
      background: "#8B2E3F",
      color: "#F7F2EA",
      "font-family": "'Jost', sans-serif",
      "font-weight": "500",
      "letter-spacing": "0.12em",
      "text-transform": "uppercase",
      "border-radius": "2px",
      transition: "background 0.3s ease"
    },
    ".gallery": { background: "#F7F2EA" },
    ".gallery-eyebrow": {
      color: "#B89965",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.72rem",
      "letter-spacing": "0.3em",
      "text-transform": "uppercase"
    },
    ".gallery-heading": {
      "font-family": "'Cormorant Garamond', serif",
      "font-size": "clamp(2rem, 5vw, 3rem)",
      "font-weight": "400",
      color: "#2A1E1C"
    },
    ".gallery-sub": {
      color: "rgba(42,30,28,0.6)",
      "font-family": "'Jost', sans-serif",
      "font-style": "italic"
    },
    ".gallery-item": {
      background: "#EDE3D3",
      "border-radius": "2px"
    },
    ".gallery-placeholder": {
      color: "rgba(139,46,63,0.25)",
      "font-family": "'Great Vibes', cursive",
      "font-size": "2.4rem"
    },
    ".faq": { background: "#EDE3D3" },
    ".faq-heading": {
      "font-family": "'Cormorant Garamond', serif",
      "font-size": "clamp(2rem, 5vw, 2.8rem)",
      "font-weight": "400",
      color: "#2A1E1C"
    },
    ".faq-question": {
      color: "#2A1E1C",
      "font-family": "'Cormorant Garamond', serif",
      "font-size": "1.2rem",
      "border-bottom": "1px solid rgba(184,153,101,0.3)",
      transition: "color 0.2s ease"
    },
    ".faq-icon": { color: "#8B2E3F", "font-size": "1.4rem" },
    ".faq-answer": {
      color: "rgba(42,30,28,0.74)",
      "font-family": "'Jost', sans-serif",
      "font-size": "0.98rem",
      "line-height": "1.7"
    },
    "footer": {
      background: "#EDE3D3",
      color: "rgba(42,30,28,0.72)",
      "border-top": "1px solid rgba(184,153,101,0.3)"
    },
    ".footer-names": {
      "font-family": "'Great Vibes', cursive",
      "font-size": "2.4rem",
      color: "#8B2E3F"
    },
    ".footer-info": {
      "font-family": "'Jost', sans-serif",
      "font-size": "0.88rem",
      color: "rgba(42,30,28,0.64)",
      "letter-spacing": "0.08em"
    },
    ".footer-tagline": {
      "font-family": "'Cormorant Garamond', serif",
      "font-style": "italic",
      "font-size": "0.92rem",
      color: "rgba(42,30,28,0.48)"
    },
    // --- Layout-specific extras ---
    // L2 — Romantic Traditional: offset decoration behind the story photo
    ".story-photo-decoration": {
      background: "#B89965",
      opacity: "0.22"
    },
    // L2 — Romantic Traditional: split RSVP decorative panel
    ".rsvp-decorative": {
      background: "#EDE3D3",
      "border-left": "2px solid #B89965",
      "border-radius": "2px"
    },
    ".rsvp-decorative-quote": {
      "font-family": "'Cormorant Garamond', serif",
      "font-style": "italic",
      "font-size": "1.3rem",
      color: "#8B2E3F",
      "line-height": "1.55"
    },
    ".rsvp-decorative-names": {
      "font-family": "'Great Vibes', cursive",
      "font-size": "2.2rem",
      color: "#8B2E3F",
      "margin-top": "1.5rem"
    },
    // L4 — Editorial Bold: full-width prominent RSVP header
    ".rsvp-header-full": {
      background: "#8B2E3F",
      "border-top": "1px solid rgba(184,153,101,0.45)",
      "border-bottom": "1px solid rgba(184,153,101,0.45)"
    },
    ".rsvp-header-full .rsvp-eyebrow": {
      color: "#E8C88C"
    },
    ".rsvp-header-full .rsvp-heading": {
      color: "#F7F2EA"
    }
  },
  fonts: [
    "Great Vibes",
    "Cormorant Garamond:ital,wght@0,400;0,500;0,600;1,400",
    "Jost:wght@300;400;500"
  ],
  particles: { effect: "none", colors: [], count: 0, opacity: 0 },
  content: {
    TAGLINE: "Two stories becoming one",
    CTA_LABEL: "Accept with joy",
    STORY_EYEBROW: "Our story",
    STORY_SCRIPT_TITLE: "How we began",
    STORY_HEADING: "From a friend's party to <em>forever</em>",
    STORY_P1:
      "It was an ordinary evening at a friend's party — until it wasn't. Priya was laughing at someone's story. Arjun walked in and everything slowed down by half a beat. Neither of us remembers what was said first; we both remember not wanting the conversation to end.",
    STORY_QUOTE: "A chance meeting that felt like coming home.",
    STORY_P2:
      "Months turned into a year, and a year turned into something we finally had a word for. Now we'd like you — the people who shaped us, fed us, celebrated with us — to stand with us as we turn that word into a promise. The Leela Palace in Udaipur, on the first of May. Your presence would mean everything.",
    EVENTS_EYEBROW: "The celebration",
    EVENTS_HEADING: "A day, a night, and a marriage",
    RSVP_EYEBROW: "Kindly respond",
    RSVP_HEADING: "Will you celebrate with us?",
    RSVP_SUB: "We would love a quick note so we can save you a seat.",
    RSVP_ACCEPT_LABEL: "Joyfully accepts",
    RSVP_DECLINE_LABEL: "Regretfully declines",
    RSVP_SUBMIT_LABEL: "Send with love",
    RSVP_SUCCESS_TITLE: "Thank you",
    RSVP_SUCCESS_MESSAGE: "Your response made our day. See you soon in Udaipur.",
    GALLERY_EYEBROW: "Moments",
    GALLERY_HEADING: "Pieces of us",
    GALLERY_SUB: "A few of the mornings, the mountains, the in-between.",
    FAQ_HEADING: "Questions our families keep asking",
    FAQ_1_Q: "What time should I arrive?",
    FAQ_1_A: "Doors open at 3:30 PM for the ceremony at 4:30 PM. Arriving a little early gives you time to find your seat and take everything in.",
    FAQ_2_Q: "Is there a dress code?",
    FAQ_2_A: "Cocktail semi-formal. Think what you'd wear to a beautiful dinner — comfortable, elegant, nothing too heavy for a May evening in Udaipur.",
    FAQ_3_Q: "Can I bring my kids?",
    FAQ_3_A: "Yes, children are warmly welcome. Let us know in your RSVP how many so we can plan activities and seating.",
    FAQ_4_Q: "Where can I stay?",
    FAQ_4_A: "We've reserved a block of rooms at The Leela Palace at a reduced rate. Mention \"Priya & Arjun wedding\" when you book by 1 April 2026.",
    FAQ_5_Q: "Are gifts expected?",
    FAQ_5_A: "Your presence is the real gift. If you'd like to send something anyway, there's a registry link at the top of the FAQ card.",
    FAQ_6_Q: "Will the ceremony be outdoors?",
    FAQ_6_A: "Partially. The vows are in the palace courtyard, weather permitting, with a covered tent as backup. Bring a light shawl for after sunset.",
    FOOTER_TAGLINE: "Made with love — for the people who made us."
  },
  designSummary:
    "Warm cream and deep-rose palette with muted gold accents — romantic, editorial, and grounded. Great Vibes script for display, Cormorant Garamond for headings, Jost for body: traditional without being old-fashioned.",
  reasoning: {
    palette:
      "Cream (#F7F2EA) as the base reads warm in Udaipur's late-afternoon light, burgundy-rose (#8B2E3F) lends the gravitas of a palace wedding without turning red, muted gold (#B89965) ties both halves.",
    fonts:
      "Great Vibes for the couple's names carries emotional weight; Cormorant Garamond headings stay editorial rather than sentimental; Jost body copy keeps the long read comfortable on mobile.",
    mood:
      "Intimate but intentional. Nothing gaudy — the Leela Palace does enough heavy lifting visually; the site is restrained so their actual photos will pop when they upload them."
  }
};

// ---------- Call 3 — hero HTML --------------------------------------------
// Authored to match what our Call 3 prompt would produce for this couple:
// uses globalTokens values, full creative freedom, all required placeholders.

const HERO_HTML = `<section class="hero">
  <div class="hero-inner">
    <div class="hero-eyebrow">The wedding of</div>
    <h1 class="hero-names">
      <span class="hero-name hero-name-1">{{PERSON1_NAME}}</span>
      <span class="hero-connector">&amp;</span>
      <span class="hero-name hero-name-2">{{PERSON2_NAME}}</span>
    </h1>
    <span class="bilingual-secondary">{{PERSON1_NAME_BILINGUAL}} {{PERSON2_NAME_BILINGUAL}}</span>
    <p class="hero-tagline">{{TAGLINE}}</p>
    <div class="hero-divider" aria-hidden="true"></div>
    <p class="hero-date">{{WEDDING_DATE_DISPLAY}}</p>
    <span class="bilingual-secondary">{{WEDDING_DATE_BILINGUAL}}</span>
    <p class="hero-venue">{{VENUE_NAME}} · {{VENUE_CITY}}</p>
    <span class="bilingual-secondary">{{VENUE_NAME_BILINGUAL}}</span>

    <div class="hero-countdown" aria-live="polite">
      <div class="countdown-item"><span id="cd-days" class="countdown-num">—</span><span class="countdown-label">Days</span></div>
      <div class="countdown-item"><span id="cd-hours" class="countdown-num">—</span><span class="countdown-label">Hours</span></div>
      <div class="countdown-item"><span id="cd-mins" class="countdown-num">—</span><span class="countdown-label">Mins</span></div>
      <div class="countdown-item"><span id="cd-secs" class="countdown-num">—</span><span class="countdown-label">Secs</span></div>
    </div>

    <a class="hero-cta" href="#rsvp">{{CTA_LABEL}}</a>
  </div>

  <style>
    .hero {
      background:
        radial-gradient(ellipse 80% 60% at 50% 20%, rgba(200,116,130,0.18), transparent 70%),
        linear-gradient(180deg, #F7F2EA 0%, #EDE3D3 100%);
      color: #2A1E1C;
      padding: clamp(5rem, 12vw, 9rem) clamp(1.5rem, 6vw, 4rem) clamp(4rem, 10vw, 7rem);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hero::before,
    .hero::after {
      content: "";
      position: absolute;
      width: 1px;
      background: linear-gradient(180deg, transparent, #B89965 30%, #B89965 70%, transparent);
      top: 10%;
      bottom: 10%;
      opacity: 0.5;
    }
    .hero::before { left: 8%; }
    .hero::after  { right: 8%; }
    .hero-inner { max-width: 820px; margin: 0 auto; position: relative; }
    .hero-eyebrow {
      font-family: 'Jost', sans-serif;
      font-size: 0.78rem;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: #B89965;
      margin-bottom: 2rem;
    }
    .hero-names {
      font-family: 'Great Vibes', cursive;
      font-size: clamp(3.2rem, 11vw, 7.5rem);
      font-weight: 400;
      line-height: 1;
      color: #8B2E3F;
      margin: 0;
    }
    .hero-name-1, .hero-name-2 { display: inline-block; }
    .hero-connector {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(1.8rem, 5vw, 3rem);
      font-style: italic;
      color: #B89965;
      margin: 0 0.3em;
      vertical-align: 0.18em;
    }
    .bilingual-secondary {
      display: block;
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.05rem;
      color: rgba(42,30,28,0.5);
      margin-top: 0.4rem;
    }
    .bilingual-secondary:empty { display: none; }
    .hero-tagline {
      font-family: 'Cormorant Garamond', serif;
      font-style: italic;
      font-size: clamp(1.15rem, 2.6vw, 1.5rem);
      color: rgba(42,30,28,0.72);
      margin: 1.6rem 0 0;
    }
    .hero-divider {
      width: 60px;
      height: 1px;
      background: #B89965;
      margin: 2.8rem auto 2rem;
      position: relative;
    }
    .hero-divider::before,
    .hero-divider::after {
      content: "";
      position: absolute;
      top: 50%;
      width: 4px;
      height: 4px;
      background: #B89965;
      border-radius: 50%;
      transform: translateY(-50%);
    }
    .hero-divider::before { left: -10px; }
    .hero-divider::after { right: -10px; }
    .hero-date {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(1.3rem, 3vw, 1.8rem);
      color: #2A1E1C;
      margin: 0;
      letter-spacing: 0.04em;
    }
    .hero-venue {
      font-family: 'Jost', sans-serif;
      font-size: 0.9rem;
      color: rgba(42,30,28,0.62);
      letter-spacing: 0.22em;
      text-transform: uppercase;
      margin: 0.9rem 0 0;
    }
    .hero-countdown {
      display: flex;
      justify-content: center;
      gap: clamp(1.2rem, 4vw, 3rem);
      margin: 3.2rem 0 2.8rem;
    }
    .countdown-item { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
    .countdown-num {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 500;
      color: #8B2E3F;
      line-height: 1;
    }
    .countdown-label {
      font-family: 'Jost', sans-serif;
      font-size: 0.62rem;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: rgba(42,30,28,0.42);
    }
    .hero-cta {
      display: inline-block;
      padding: 1.1rem 2.8rem;
      background: #8B2E3F;
      color: #F7F2EA;
      font-family: 'Jost', sans-serif;
      font-size: 0.82rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      text-decoration: none;
      border-radius: 2px;
      transition: transform 0.25s ease, background 0.25s ease;
    }
    .hero-cta:hover { background: #731F2F; transform: translateY(-1px); }
    @media (max-width: 768px) {
      .hero::before, .hero::after { display: none; }
      .hero-countdown { gap: 1.1rem; }
    }
  </style>

  <script>
    (function () {
      var target = new Date("2026-05-01T16:00:00Z").getTime();
      function pad(n) { return n < 10 ? "0" + n : String(n); }
      function tick() {
        var now = Date.now();
        var diff = target - now;
        var cd = document.querySelector(".hero-countdown");
        if (diff <= 0) { if (cd) cd.style.display = "none"; return; }
        var d = Math.floor(diff / 86400000);
        var h = Math.floor((diff % 86400000) / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        var days = document.getElementById("cd-days"); if (days) days.textContent = d;
        var hrs = document.getElementById("cd-hours"); if (hrs) hrs.textContent = pad(h);
        var mins = document.getElementById("cd-mins"); if (mins) mins.textContent = pad(m);
        var secs = document.getElementById("cd-secs"); if (secs) secs.textContent = pad(s);
      }
      tick();
      setInterval(tick, 1000);
    })();
  </script>
</section>`;

// ---------- Events (fed to renderer as EventData[]) -----------------------

const EVENTS: EventData[] = [
  {
    id: "evt-ceremony",
    couple_id: COUPLE.id,
    name: "Ceremony",
    event_type: null,
    event_date: "Friday, 1 May 2026",
    event_time: "4:30 PM",
    venue: "The Leela Palace, Udaipur (Courtyard)",
    dress_code: "Cocktail semi-formal",
    sort_order: 0
  },
  {
    id: "evt-reception",
    couple_id: COUPLE.id,
    name: "Reception",
    event_type: null,
    event_date: "Friday, 1 May 2026",
    event_time: "7:30 PM",
    venue: "The Leela Palace, Udaipur (Lakeside Terrace)",
    dress_code: "Cocktail semi-formal",
    sort_order: 1
  }
];

// ---------- Run the real renderer -----------------------------------------

function findLayoutsRoot(): string | null {
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, "layouts", "layout-1-modern", "skeleton.html");
    if (fs.existsSync(candidate)) return path.join(current, "layouts");
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

const layoutsRoot = findLayoutsRoot();
const maybeIt = layoutsRoot ? it : it.skip;

const LAYOUT_META: Array<{ id: LayoutId; nickname: string }> = [
  { id: "layout-1", nickname: "modern" },
  { id: "layout-2", nickname: "romantic" },
  { id: "layout-3", nickname: "grand" },
  { id: "layout-4", nickname: "editorial" }
];

describe("Priya & Arjun — full invitation render across all four layouts", () => {
  maybeIt("renders layouts 1, 2, 3, 4 and saves each to output/", () => {
    const outDir = path.join(layoutsRoot!, "..", "output");
    fs.mkdirSync(outDir, { recursive: true });

    for (const { id, nickname } of LAYOUT_META) {
      const input: RenderInput = {
        layoutId: id,
        themeJson: THEME_JSON,
        heroHtml: HERO_HTML,
        culturalProfile: null,
        couple: COUPLE,
        events: EVENTS,
        rsvpConfig: smartDefaultsForProfile(null, EVENTS.length),
        customSections: []
      };

      const html = render(input);

      // Sanity across every layout.
      expect(html, `${id} missing Priya`).toContain("Priya");
      expect(html, `${id} missing Arjun`).toContain("Arjun");
      expect(html, `${id} missing date`).toContain("Friday, 1 May 2026");
      expect(html, `${id} missing venue`).toContain("The Leela Palace");
      const leaks = (html.match(/\{\{[^}]+\}\}/g) ?? []).filter(
        (m) => !m.startsWith("{{PHOTO:")
      );
      expect(leaks, `${id} unresolved placeholders: ${leaks.join(", ")}`).toEqual([]);

      const outPath = path.join(outDir, `priya-arjun-${id}-${nickname}.html`);
      fs.writeFileSync(outPath, html);
      console.log(`  ✓ ${id} (${nickname}): ${outPath} — ${html.length} bytes`);
    }

    // One more pass — an index page linking to all four for easy comparison.
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Priya & Arjun — All Four Layouts</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      background: #F7F2EA;
      color: #2A1E1C;
      padding: 3rem 2rem;
      min-height: 100vh;
    }
    .wrap { max-width: 960px; margin: 0 auto; }
    h1 {
      font-family: Georgia, "Cormorant Garamond", serif;
      font-weight: 400;
      font-size: clamp(2rem, 5vw, 3rem);
      margin-bottom: 0.5rem;
      color: #8B2E3F;
    }
    p.lede {
      color: rgba(42,30,28,0.7);
      margin-bottom: 3rem;
      max-width: 64ch;
      line-height: 1.6;
    }
    .meta {
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 0.75rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #B89965;
      margin-bottom: 0.6rem;
    }
    ul { list-style: none; display: grid; gap: 1.2rem; }
    li a {
      display: block;
      padding: 1.4rem 1.8rem;
      background: #FFFFFF;
      border: 1px solid rgba(184,153,101,0.3);
      border-radius: 3px;
      color: #2A1E1C;
      text-decoration: none;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    li a:hover {
      border-color: #8B2E3F;
      transform: translateX(4px);
    }
    li a h2 {
      font-family: Georgia, "Cormorant Garamond", serif;
      font-weight: 400;
      font-size: 1.4rem;
      margin-bottom: 0.2rem;
    }
    li a p {
      color: rgba(42,30,28,0.6);
      font-size: 0.95rem;
    }
    footer {
      margin-top: 4rem;
      font-size: 0.82rem;
      color: rgba(42,30,28,0.45);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="meta">§ Example renders — same couple, four layouts</div>
    <h1>Priya &amp; Arjun</h1>
    <p class="lede">
      The same couple, same date, same palette, same hero — rendered through each of the
      four layout skeletons. Open each and compare how the structural differences shape
      the same design language.
    </p>
    <ul>
      <li><a href="priya-arjun-layout-1-modern.html">
        <h2>Layout 1 — Modern Minimalist</h2>
        <p>Equal two-column story, auto-fit events row, uniform 3-column gallery. Lots of air.</p>
      </a></li>
      <li><a href="priya-arjun-layout-2-romantic.html">
        <h2>Layout 2 — Romantic Traditional</h2>
        <p>Photo with offset gold decoration, watermark event numbers, split RSVP with a decorative quote panel.</p>
      </a></li>
      <li><a href="priya-arjun-layout-3-grand.html">
        <h2>Layout 3 — Grand Celebration</h2>
        <p>Centered story (no photo column), generous multi-event grid, ornamental RSVP spacing.</p>
      </a></li>
      <li><a href="priya-arjun-layout-4-editorial.html">
        <h2>Layout 4 — Editorial Bold</h2>
        <p>Asymmetric 60/40 story with text leading, two-column magazine events, full-width RSVP header, CSS masonry gallery.</p>
      </a></li>
    </ul>
    <footer>Generated by tests/priya-arjun-example.test.ts — regenerate with <code>npx vitest run tests/priya-arjun-example.test.ts</code>.</footer>
  </div>
</body>
</html>`;
    fs.writeFileSync(path.join(outDir, "index.html"), indexHtml);
    console.log(`\n  ✓ index: ${path.join(outDir, "index.html")}\n`);
  });
});
