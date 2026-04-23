// Builds the <style> block from a validated StylesMap.
// Skips empty blocks so the stripped-property case from the validator doesn't
// emit bare `selector {}` rules.

import type { StylesMap } from "@/lib/types";

export function buildCssFromTokens(styles: StylesMap): string {
  const blocks: string[] = [];
  for (const [selector, props] of Object.entries(styles)) {
    const lines: string[] = [];
    for (const [prop, value] of Object.entries(props)) {
      if (value === undefined || value === null || String(value).trim() === "") continue;
      lines.push(`  ${prop}: ${value};`);
    }
    if (lines.length === 0) continue;
    blocks.push(`${selector} {\n${lines.join("\n")}\n}`);
  }
  return blocks.join("\n\n");
}

/**
 * Builds a `<link>` tag for Google Fonts from an approved-fonts array.
 * Each entry may be a plain family ("Inter") or family:weights ("Inter:400,600").
 */
export function buildFontsLink(fonts: string[]): string {
  if (!fonts || fonts.length === 0) return "";
  const families = fonts
    .map((entry) => {
      const [family, weights] = entry.split(":");
      const f = family.trim().replace(/\s+/g, "+");
      if (!weights) return `family=${f}`;
      const w = weights.split(",").map((x) => x.trim()).filter(Boolean).join(";");
      return `family=${f}:wght@${w}`;
    })
    .join("&");
  return `<link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
}
