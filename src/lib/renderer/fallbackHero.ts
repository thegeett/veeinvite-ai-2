// Call 3 fallback envelope.
//
// When validateHeroJson rejects AI's Call 3 output, we render this envelope
// instead. Goals:
//   1. Visually coherent with the couple's chosen palette (uses globalTokens).
//   2. Structurally identical to a real hero (passes the validator itself).
//   3. Includes every required placeholder so the renderer's substitution
//      pass produces a complete, populated hero.
//   4. Marked with data-fallback="true" by the assembler (caller passes the
//      flag) so dashboards can flag "fallback used" generations.
//
// Per design (doc/hero_html_extraction.md): min-height 60vh — visually distinct
// from a polished custom hero so internal review can spot fallback events
// without needing to query the data-fallback attribute.

import type { ExpressivePalette, HeroJsonEnvelope } from "@/lib/types";

/**
 * PALETTE-03: parses an `hsl(H, S%, L%)` string and returns true when the
 * lightness is < 50%. Used to flip default text colours between dark-bg and
 * light-bg fallback heroes. Defensive: returns true (assume dark bg) for
 * any non-HSL or unparseable input.
 */
function isDarkBg(hsl: string): boolean {
  const match = hsl.match(/^\s*hsl\(\s*\d+\s*,\s*\d+%\s*,\s*(\d+)%\s*\)\s*$/);
  if (!match) return true;
  return parseInt(match[1], 10) < 50;
}

export function buildFallbackEnvelope(palette: ExpressivePalette): HeroJsonEnvelope {
  // PALETTE-03: synthesize the design-system tokens the fallback hero needs
  // from the 4 expressive ones. Call 2 normally fills these, but the
  // fallback hero may be reached before / instead of Call 2 returning, so
  // we derive sensible defaults from bgPrimary's lightness.
  const dark = isDarkBg(palette.bgPrimary);
  const textPrimary = dark ? "rgba(253,246,238,0.92)" : "rgba(29,26,26,0.9)";
  const textMuted = dark ? "rgba(253,246,238,0.55)" : "rgba(29,26,26,0.55)";
  const fontHeading = "Cormorant Garamond";
  const fontBody = "Jost";

  const globalTokens = {
    bgPrimary: palette.bgPrimary,
    accent: palette.accent,
    gold: palette.gold,
    fontDisplay: palette.fontDisplay,
    textPrimary,
    textMuted,
    fontHeading,
    fontBody
  };

  const html = `
<div class="hero__inner">
  <p class="hero__eyebrow">{{TAGLINE}}</p>
  <h1 class="hero__names">
    <span class="hero__name">{{PERSON1_NAME}}</span>
    <span class="hero__amp">&amp;</span>
    <span class="hero__name">{{PERSON2_NAME}}</span>
  </h1>
  <p class="hero__date">{{WEDDING_DATE_DISPLAY}}</p>
  <p class="hero__venue">{{VENUE_NAME}} &middot; {{VENUE_CITY}}</p>
  <a class="hero__cta" href="#rsvp">{{CTA_LABEL}}</a>
</div>
`.trim();

  const style = `
.hero {
  min-height: 60vh;
  padding: 80px 24px;
  background: ${globalTokens.bgPrimary};
  color: ${globalTokens.textPrimary};
  text-align: center;
  font-family: ${globalTokens.fontBody}, serif;
}
.hero__inner {
  max-width: 720px;
  margin: 0 auto;
}
.hero__eyebrow {
  font-family: ${globalTokens.fontHeading}, serif;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-size: 0.8rem;
  color: ${globalTokens.textMuted};
  margin: 0 0 32px;
}
.hero__names {
  font-family: ${globalTokens.fontDisplay}, serif;
  font-weight: 400;
  font-size: clamp(2.6rem, 7vw, 4.8rem);
  line-height: 1.1;
  margin: 0 0 24px;
  color: ${globalTokens.textPrimary};
}
.hero__name { display: block; }
.hero__amp {
  display: block;
  font-style: italic;
  color: ${globalTokens.accent};
  font-size: 0.7em;
  margin: 8px 0;
}
.hero__date {
  font-family: ${globalTokens.fontHeading}, serif;
  font-size: 1.1rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: ${globalTokens.accent};
  margin: 32px 0 12px;
}
.hero__venue {
  font-size: 1rem;
  color: ${globalTokens.textMuted};
  margin: 0 0 40px;
}
.hero__cta {
  display: inline-block;
  padding: 14px 36px;
  background: ${globalTokens.accent};
  color: ${globalTokens.bgPrimary};
  text-decoration: none;
  font-family: ${globalTokens.fontHeading}, sans-serif;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-size: 0.85rem;
  border-radius: 2px;
  transition: opacity 0.2s ease;
}
.hero__cta:hover { opacity: 0.85; }
`.trim();

  return { html, style, script: "" };
}
