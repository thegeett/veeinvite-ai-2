"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutMini } from "@/components/landing/LayoutMini";
import type { LayoutId } from "@/lib/types";

type Mode = "mobile" | "desktop";
const WIDTHS: Record<Mode, number> = { mobile: 390, desktop: 1280 };

export type PickedElement = { key: string; label: string } | null;

const ELEMENT_LABELS: Record<string, string> = {
  ".hero-names": "Hero names",
  ".hero-tagline": "Hero tagline",
  ".hero-cta": "RSVP button",
  ".story-heading": "Story heading",
  ".story-quote": "Story quote",
  ".story-eyebrow": "Story label",
  ".event-card": "Event card",
  ".event-name": "Event name",
  ".rsvp-heading": "RSVP heading",
  ".rsvp-submit": "Submit button",
  ".faq-question": "FAQ question",
  ".footer-names": "Footer names",
  ".footer-tagline": "Footer tagline",
  nav: "Navigation",
  ".nav-monogram": "Monogram"
};

type Props = {
  slug: string;
  layoutId?: LayoutId | null;
  onPick: (pick: PickedElement) => void;
  picked: PickedElement;
  useFallback?: boolean;
};

/**
 * Iframe wrapper for the /w/[slug] generated site with:
 *   - mobile (375) / desktop toggle
 *   - postMessage listener for content-picker selections from the iframe
 *   - fallback placeholder when Stream C's route is still a stub
 *
 * Content-picker contract (plan §30):
 *   The generated site's JS listens for clicks and posts
 *     { type: "veein:content-pick", key: "STORY_QUOTE", label: "Story quote" }
 *   to window.parent. This component forwards pick events to the parent dashboard.
 */
export function SitePreview({ slug, layoutId, onPick, picked, useFallback }: Props) {
  const [mode, setMode] = useState<Mode>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeAvailable, setIframeAvailable] = useState(!useFallback);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "veein:content-pick" && typeof data.key === "string") {
        onPick({ key: data.key, label: data.label ?? ELEMENT_LABELS[data.key] ?? data.key });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onPick]);

  const flavor = flavorForLayout(layoutId);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="veein-meta text-stone">§ Preview · /w/{slug}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("mobile")}
            className={`rounded-full px-3 py-1 text-xs ${
              mode === "mobile" ? "bg-ink text-canvas" : "bg-paper text-ink border border-line"
            }`}
          >
            Mobile
          </button>
          <button
            type="button"
            onClick={() => setMode("desktop")}
            className={`rounded-full px-3 py-1 text-xs ${
              mode === "desktop" ? "bg-ink text-canvas" : "bg-paper text-ink border border-line"
            }`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => iframeRef.current?.contentWindow?.location.reload()}
            className="rounded-full bg-paper border border-line px-3 py-1 text-xs hover:border-ink/40"
            title="Reload preview"
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* Picker chip */}
      {picked ? (
        <div className="flex items-center gap-2 self-start rounded-full bg-blush/10 border border-blush/40 px-3 py-1 text-sm">
          <span className="veein-meta text-blush">Picked</span>
          <span>{picked.label}</span>
          <button
            type="button"
            onClick={() => onPick(null)}
            className="text-blush/70 hover:text-blush"
            aria-label="Clear picked element"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Preview frame */}
      <div className="rounded-md border border-line bg-paper p-4">
        <div className="mx-auto" style={{ width: `${WIDTHS[mode]}px`, maxWidth: "100%" }}>
          {iframeAvailable ? (
            <iframe
              ref={iframeRef}
              title="Your wedding site preview"
              src={`/w/${slug}?edit=1`}
              className="block h-[calc(100vh-280px)] min-h-[500px] w-full bg-canvas"
              onError={() => setIframeAvailable(false)}
              onLoad={() => {
                // If the iframe loaded a 404/501 body, we could fall back.
                // Keep it simple: trust the route when rendered.
              }}
            />
          ) : (
            <div className="relative min-h-[500px] bg-canvas">
              <div className="absolute inset-6 flex flex-col items-center justify-center gap-5 text-center">
                <div className="veein-meta text-stone">
                  Rendered site appears here once Stream C&apos;s /w/[slug] route is live.
                </div>
                <div className="w-[300px]">
                  <LayoutMini flavor={flavor} />
                </div>
                <div className="text-xs text-ink/50 max-w-xs">
                  For now, a schematic is shown. The preview column in onboarding uses the same
                  technique.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function flavorForLayout(id?: LayoutId | null): "modern" | "romantic" | "grand" | "editorial" {
  switch (id) {
    case "layout-2":
      return "romantic";
    case "layout-3":
      return "grand";
    case "layout-4":
      return "editorial";
    default:
      return "modern";
  }
}
