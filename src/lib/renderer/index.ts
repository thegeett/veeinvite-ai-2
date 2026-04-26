// render — the §4 pipeline's final step.
//
// Input: validated theme_json, hero HTML, cultural profile, couple DB data,
// events, RSVP config, custom sections.
//
// Output: a complete self-contained HTML document ready to write to storage.
//
// Order is load-bearing. Do not reorder:
//   1.  Load skeleton HTML by layoutId.
//   2.  Validate theme_json (defensive — pipeline already validated once).
//   3.  Build CSS string from theme_json.styles.
//   4.  Build Google Fonts <link> from theme_json.fonts.
//   5.  Inject <style> + fonts link into skeleton <head>.
//   6.  Inject particle background JS from theme_json.particles (if any).
//   7.  Substitute theme_json.content into {{PLACEHOLDER}} tokens.
//   8.  Build and inject {{EVENTS_CARDS}} via buildEventCards.
//   9.  Build and inject {{RSVP_FORM}} via buildRSVPForm.
//   10. Prepend hero HTML before the skeleton's first <section>.
//   11. Inject cultural content items via injectCulturalContent (hero, faq,
//       footer, custom sections).
//   12. Prepend custom sections (user-authored) before footer.
//   13. injectStructured LAST — real names/dates/venues overwrite AI copy.

import fs from "node:fs";
import path from "node:path";

import type {
  ContentMap,
  CulturalProfile,
  CustomSection,
  LayoutId,
  ParticleConfig,
  RenderInput,
  ThemeJSON
} from "@/lib/types";
import { validateAll } from "@/lib/validator";
import { buildCssFromTokens, buildFontsLink } from "./buildCssFromTokens";
import { buildEventCards } from "./buildEventCards";
import { buildRSVPForm } from "@/lib/rsvp/config";
import { injectHero } from "./injectHero";
import { injectCulturalContent } from "./injectCulturalContent";
import { injectStructured } from "./injectStructured";

const LAYOUT_DIR: Record<LayoutId, string> = {
  "layout-1": "layout-1-modern",
  "layout-2": "layout-2-romantic",
  "layout-3": "layout-3-grand",
  "layout-4": "layout-4-editorial"
};

let cachedRoot: string | null = null;

function resolveLayoutsRoot(): string {
  if (cachedRoot) return cachedRoot;
  // Search upward from cwd for a `layouts/` directory that contains any of
  // the four known subdirectories. Supports both the engine and backend
  // worktrees (layouts live at the repo root on main).
  const candidates: string[] = [];
  let current = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const dir of candidates) {
    const candidate = path.join(dir, "layouts");
    if (fs.existsSync(candidate)) {
      cachedRoot = candidate;
      return candidate;
    }
  }
  // Fallback: assume repo root = cwd.
  cachedRoot = path.join(process.cwd(), "layouts");
  return cachedRoot;
}

export function loadSkeleton(layoutId: LayoutId, overrideRoot?: string): string {
  const root = overrideRoot ?? resolveLayoutsRoot();
  const subdir = LAYOUT_DIR[layoutId] ?? LAYOUT_DIR["layout-1"];
  const file = path.join(root, subdir, "skeleton.html");
  return fs.readFileSync(file, "utf8");
}

// --------- Helpers --------------------------------------------------------

function replaceAllLiteral(src: string, needle: string, replacement: string): string {
  if (!needle) return src;
  return src.split(needle).join(replacement);
}

function injectIntoHead(html: string, snippet: string): string {
  const closeHead = html.indexOf("</head>");
  if (closeHead === -1) return snippet + html;
  return html.slice(0, closeHead) + snippet + "\n" + html.slice(closeHead);
}

// Structured placeholders are owned by injectStructured — the content pass
// must not consume them, even if a stray AI output put them in the content map.
const STRUCTURED_KEYS = new Set([
  "PERSON1_NAME",
  "PERSON2_NAME",
  "PERSON1_NAME_BILINGUAL",
  "PERSON2_NAME_BILINGUAL",
  "WEDDING_DATE",
  "WEDDING_DATE_DISPLAY",
  "WEDDING_DATE_ISO",
  "WEDDING_DATE_BILINGUAL",
  "VENUE_NAME",
  "VENUE_NAME_BILINGUAL",
  "VENUE_CITY",
  "MONOGRAM",
  "SLUG",
  "COUNTDOWN_TARGET"
]);

function injectContent(html: string, content: ContentMap): string {
  let out = html;
  for (const [key, value] of Object.entries(content)) {
    if (STRUCTURED_KEYS.has(key)) continue;
    out = replaceAllLiteral(out, `{{${key}}}`, value);
  }
  // Any unresolved content-only tokens (FAQ_6_Q etc. not supplied by AI) become
  // empty strings rather than leaking `{{...}}` to guests.
  out = out.replace(/\{\{FAQ_[0-9]+_[QA]\}\}/g, "");
  return out;
}

function buildParticleScript(p: ParticleConfig): string {
  if (p.effect === "none" || p.count === 0) return "";
  const colors = JSON.stringify(p.colors.length ? p.colors : ["#ffffff"]);
  const opacity = p.opacity.toFixed(3);
  const count = p.count;
  const effect = p.effect;
  return `<script>
(function () {
  var container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
  document.body.appendChild(container);
  var colors = ${colors};
  var kind = ${JSON.stringify(effect)};
  for (var i = 0; i < ${count}; i++) {
    var dot = document.createElement('span');
    var size = kind === 'petals' ? 8 + Math.random() * 10 : 2 + Math.random() * 4;
    dot.style.cssText = [
      'position:absolute',
      'top:' + Math.random() * 100 + '%',
      'left:' + Math.random() * 100 + '%',
      'width:' + size + 'px',
      'height:' + size + 'px',
      'border-radius:50%',
      'background:' + colors[i % colors.length],
      'opacity:' + ${opacity},
      'transition:transform 12s linear, top 12s linear',
      'will-change:transform'
    ].join(';');
    container.appendChild(dot);
  }
})();
</script>`;
}

function buildPhotoMarkersFor(profile: CulturalProfile | null): void {
  // Placeholder hook — photos are currently emitted by Stream C-controlled
  // paths. Kept for future renderer-owned photo insertion (story, hero bg).
  return;
  // Intentional no-op; reference profile to avoid lint when unused:
  void profile;
}

// --------- Main render ----------------------------------------------------

export interface RenderOptions {
  /** Override layouts root — used by tests and by alternate worktrees. */
  layoutsRoot?: string;
  /** Allow tests to bypass fs and inject a raw skeleton string. */
  skeletonHtml?: string;
}

export function render(input: RenderInput, options: RenderOptions = {}): string {
  const skeleton =
    options.skeletonHtml ?? loadSkeleton(input.layoutId, options.layoutsRoot);

  // Defensive revalidation — pipeline validates once but render() is part of
  // the public surface (Stream C calls it directly for restores).
  const validated = validateAll(input.themeJson as unknown as ThemeJSON);

  const css = buildCssFromTokens(validated.styles);
  const fontsLink = buildFontsLink(validated.fonts);
  const particleScript = buildParticleScript(validated.particles);
  buildPhotoMarkersFor(input.culturalProfile);

  // 1. Head injection: fonts link + <style> block.
  let html = skeleton;
  const headSnippet = [fontsLink, css ? `<style id="veeinvite-theme">\n${css}\n</style>` : ""]
    .filter(Boolean)
    .join("\n");
  if (headSnippet) html = injectIntoHead(html, headSnippet);

  // 2. Particle script — appended just before </body>.
  if (particleScript) {
    const closeBody = html.lastIndexOf("</body>");
    html =
      closeBody === -1
        ? html + particleScript
        : html.slice(0, closeBody) + particleScript + "\n" + html.slice(closeBody);
  }

  // 3. Dynamic events cards.
  const eventsCards = buildEventCards({
    profile: input.culturalProfile,
    events: input.events,
    couple: input.couple,
    themeJson: input.themeJson
  });
  html = replaceAllLiteral(html, "{{EVENTS_CARDS}}", eventsCards);

  // 4. Dynamic RSVP form.
  const rsvpForm = buildRSVPForm(input.rsvpConfig, input.events);
  html = replaceAllLiteral(html, "{{RSVP_FORM}}", rsvpForm);

  // 5. Prepend hero before the first skeleton section.
  html = injectHero(html, input.heroHtml ?? "");

  // 6. Cultural content routing (hero, faq, footer, custom sections).
  html = injectCulturalContent(html, input.culturalProfile);

  // 7. User-authored custom sections — before footer, after cultural sections.
  if (input.customSections?.length) {
    html = injectCustomSections(html, input.customSections);
  }

  // 8. Content placeholders — run after hero/rsvp/cultural so embedded
  //    tokens in any of those fragments resolve (e.g. hero's {{TAGLINE}},
  //    rsvp form's {{RSVP_SUBMIT_LABEL}}).
  html = injectContent(html, validated.content);

  // 9. Structured injection — LAST (architecture rule 7).
  html = injectStructured({
    html,
    couple: input.couple,
    bilingualFields: input.culturalProfile?.bilingualEnabled
      ? input.culturalProfile.bilingualFields
      : undefined
  });

  return html;
}

function injectCustomSections(html: string, sections: CustomSection[]): string {
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const snippet = ordered
    .map(
      (s) =>
        `<section class="user-custom-section" data-custom-id="${s.id}">
  <div class="user-custom-inner">
    <h2 class="user-custom-heading">${escapeHtmlInline(s.label)}</h2>
    ${s.html}
  </div>
</section>`
    )
    .join("\n");
  const footerIdx = html.indexOf("<footer");
  if (footerIdx === -1) return html + snippet;
  return html.slice(0, footerIdx) + snippet + "\n" + html.slice(footerIdx);
}

function escapeHtmlInline(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
