// STUB — replaced by Stream B in Phase 2.
// See plan §4 (renderer pipeline) and §7 (skeleton structure).
// Real renderer loads skeleton HTML, builds CSS from tokens, injects content,
// prepends hero, and runs injectStructured() LAST (architecture rule 7).

import type { RenderInput } from "@/lib/types";

export function render(input: RenderInput): string {
  return `<!DOCTYPE html><html><head><title>VeeInvite — stub</title></head><body><p>Renderer stub for layout ${input.layoutId}. Replace in Stream B Phase 2.</p></body></html>`;
}
