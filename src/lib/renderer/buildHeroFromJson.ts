// Call 3 JSON envelope assembler.
//
// Phase B: AI returns a JSON envelope ({ html, style, script }). Our code
// owns the structural wrappers — <section class="hero">, <style>, <script> —
// so they can never go missing. See doc/phase-b-validators.md.
//
// Contract: the envelope is assumed validated upstream by validateHeroJson.
// This module does NOT re-validate; it just stitches the pieces together.

import type { HeroJsonEnvelope } from "@/lib/types";

export interface BuildHeroOptions {
  /** When true, marks the rendered hero with data-fallback="true" so the
   *  dashboard can surface "fallback used" telemetry. Default: false. */
  fallback?: boolean;
}

export function buildHeroFromJson(
  envelope: HeroJsonEnvelope,
  options: BuildHeroOptions = {}
): string {
  const { html, style, script } = envelope;
  const fallbackAttr = options.fallback ? ' data-fallback="true"' : "";

  const styleBlock = style.trim() ? `<style>${style}</style>` : "";
  const scriptBlock = script.trim() ? `<script>${script}</script>` : "";

  return [
    `<section class="hero"${fallbackAttr}>`,
    styleBlock,
    html,
    scriptBlock,
    `</section>`
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}
