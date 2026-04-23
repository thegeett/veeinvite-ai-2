// Prepends Call 3's hero HTML before the skeleton's first <section>.
// Per architecture rule 2, the hero is NOT in any skeleton. The renderer owns
// this insertion step.

export function injectHero(skeletonHtml: string, heroHtml: string): string {
  if (!heroHtml || heroHtml.trim() === "") return skeletonHtml;
  const idx = skeletonHtml.indexOf("<section");
  if (idx === -1) {
    // No section — fall back to inserting after <body> open.
    const bodyIdx = skeletonHtml.indexOf("<body");
    if (bodyIdx !== -1) {
      const close = skeletonHtml.indexOf(">", bodyIdx);
      if (close !== -1) {
        return skeletonHtml.slice(0, close + 1) + "\n" + heroHtml + "\n" + skeletonHtml.slice(close + 1);
      }
    }
    return heroHtml + skeletonHtml;
  }
  return skeletonHtml.slice(0, idx) + heroHtml + "\n" + skeletonHtml.slice(idx);
}
