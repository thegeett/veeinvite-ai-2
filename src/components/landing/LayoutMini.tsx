// Miniature CSS-only schematic previews of the four layouts.
// Purpose: the landing-page showcase needs to feel like four genuinely different sites
// without loading real wedding content. Each mini renders a stylised abstraction of
// the skeleton's structural rhythm — hero band, story split, events grid, gallery.

import { CSSProperties } from "react";

type Flavor = "modern" | "romantic" | "grand" | "editorial";

const palettes: Record<Flavor, { bg: string; fg: string; accent: string; shade: string }> = {
  modern:    { bg: "#FAF6EE", fg: "#1D1A1A", accent: "#B89965", shade: "#E4D9C6" },
  romantic:  { bg: "#2B1A1D", fg: "#F4EFE6", accent: "#C7524C", shade: "#3A2428" },
  grand:     { bg: "#14100F", fg: "#F0D9A8", accent: "#C4607A", shade: "#261A1E" },
  editorial: { bg: "#F4EFE6", fg: "#1D1A1A", accent: "#1D1A1A", shade: "#DED3C0" }
};

function Block({ style, className }: { style?: CSSProperties; className?: string }) {
  return <div className={className} style={style} />;
}

export function LayoutMini({ flavor }: { flavor: Flavor }) {
  const p = palettes[flavor];
  const s = { "--bg": p.bg, "--fg": p.fg, "--accent": p.accent, "--shade": p.shade } as CSSProperties;

  return (
    <div className="mini-root" style={s}>
      <style>{`
        .mini-root {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 4;
          background: var(--bg);
          color: var(--fg);
          overflow: hidden;
          border-radius: 2px;
        }
        .mini-root::after {
          content: "";
          position: absolute;
          inset: 0;
          border: 1px solid rgba(0,0,0,0.05);
          pointer-events: none;
          border-radius: 2px;
        }
        .mini-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 12px; font-size: 8px; opacity: 0.6;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mini-hero {
          padding: 18px 14px 14px;
          text-align: center;
        }
        .mini-hero-line { height: 3px; background: currentColor; opacity: 0.95; margin: 0 auto 4px; }
        .mini-hero-sub  { height: 2px; background: currentColor; opacity: 0.35; margin: 0 auto 8px; }
        .mini-hero-cta  { display: inline-block; height: 10px; padding: 0 10px; line-height: 10px;
                          background: var(--accent); border-radius: 2px; }
        .mini-section { padding: 10px 14px; }
        .mini-label { display: inline-block; font-size: 6px; letter-spacing: 0.2em;
                      color: var(--accent); text-transform: uppercase; margin-bottom: 4px; }
        .mini-heading { height: 3px; background: currentColor; opacity: 0.8; margin-bottom: 6px; }
        .mini-para { height: 2px; background: currentColor; opacity: 0.35; margin-bottom: 3px; }
        .mini-grid-2  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .mini-grid-3  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px; }
        .mini-grid-12 { display: grid; grid-template-columns: repeat(12,1fr); gap: 3px; }
        .mini-masonry { columns: 3; column-gap: 3px; }
        .mini-photo   { aspect-ratio: 3/4; background: var(--shade); }
        .mini-card    { padding: 8px; background: var(--shade); }
        .mini-card-num{ display: inline-block; height: 6px; width: 10px; background: var(--accent); opacity: 0.5; margin-bottom: 4px; }
        .mini-sep     { height: 1px; background: currentColor; opacity: 0.08; margin: 8px 0; }
        .mini-cell    { background: var(--shade); aspect-ratio: 1; }
        .mini-rsvp    { background: var(--shade); padding: 10px; text-align: center; }
        .mini-rsvp .mini-hero-cta { background: var(--accent); }
      `}</style>

      <div className="mini-nav">
        <span>{flavor === "romantic" || flavor === "grand" ? "A & B" : "ab"}</span>
        <span>story · events · rsvp · gallery · faq</span>
      </div>

      {/* Hero band (represents the Call-3-generated hero) */}
      <div className="mini-hero">
        <div className="mini-hero-line" style={{ width: flavor === "editorial" ? "85%" : "60%" }} />
        <div className="mini-hero-line" style={{ width: flavor === "editorial" ? "70%" : "48%", opacity: 0.8 }} />
        <div className="mini-hero-sub"  style={{ width: "40%" }} />
        <div className="mini-hero-cta" />
      </div>

      {flavor === "modern" && <ModernBody />}
      {flavor === "romantic" && <RomanticBody />}
      {flavor === "grand" && <GrandBody />}
      {flavor === "editorial" && <EditorialBody />}
    </div>
  );
}

function ModernBody() {
  return (
    <>
      <div className="mini-section">
        <span className="mini-label">01 / Story</span>
        <div className="mini-grid-2">
          <div>
            <div className="mini-heading" style={{ width: "70%" }} />
            <div className="mini-para" />
            <div className="mini-para" />
            <div className="mini-para" style={{ width: "60%" }} />
          </div>
          <div className="mini-photo" />
        </div>
      </div>
      <div className="mini-section">
        <span className="mini-label">02 / Events</span>
        <div className="mini-grid-3">
          <div className="mini-card" />
          <div className="mini-card" />
          <div className="mini-card" />
        </div>
      </div>
      <div className="mini-section">
        <div className="mini-grid-3">
          <div className="mini-cell" />
          <div className="mini-cell" />
          <div className="mini-cell" />
        </div>
      </div>
    </>
  );
}

function RomanticBody() {
  return (
    <>
      <div className="mini-section">
        <span className="mini-label">01 / Story</span>
        <div className="mini-grid-2">
          <div>
            <div className="mini-heading" style={{ width: "70%" }} />
            <div className="mini-para" />
            <div className="mini-para" style={{ width: "80%" }} />
          </div>
          <div style={{ position: "relative" }}>
            <div className="mini-photo" style={{ position: "relative", zIndex: 1 }} />
            <div
              style={{
                position: "absolute",
                inset: "4px -4px -4px 4px",
                border: "1px solid currentColor",
                opacity: 0.25,
                zIndex: 0
              }}
            />
          </div>
        </div>
      </div>
      <div className="mini-section">
        <span className="mini-label">02 / Events</span>
        <div className="mini-grid-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mini-card" style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 6,
                  fontSize: 18,
                  opacity: 0.07,
                  fontWeight: 800,
                  lineHeight: 1
                }}
              >
                {i === 1 ? "I" : i === 2 ? "II" : "III"}
              </span>
              <div className="mini-card-num" />
              <div className="mini-para" style={{ width: "60%" }} />
              <div className="mini-para" style={{ width: "80%" }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mini-section">
        <div className="mini-grid-12">
          <div style={{ gridColumn: "1/6",  background: "var(--shade)", aspectRatio: "4/5" }} />
          <div style={{ gridColumn: "6/10", background: "var(--shade)", aspectRatio: "4/3" }} />
          <div style={{ gridColumn: "10/13",background: "var(--shade)", aspectRatio: "3/4" }} />
        </div>
      </div>
    </>
  );
}

function GrandBody() {
  return (
    <>
      <div className="mini-section" style={{ textAlign: "center" }}>
        <span className="mini-label">01 / Story</span>
        <div className="mini-heading" style={{ width: "60%", margin: "4px auto 6px" }} />
        <div className="mini-para" style={{ width: "80%", margin: "0 auto 3px" }} />
        <div className="mini-para" style={{ width: "70%", margin: "0 auto 3px" }} />
        <div className="mini-para" style={{ width: "55%", margin: "0 auto 8px" }} />
      </div>
      <div className="mini-section">
        <div className="mini-grid-3" style={{ gap: "2px" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="mini-card" style={{ padding: "6px" }}>
              <div className="mini-card-num" />
              <div className="mini-para" style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mini-section">
        <div className="mini-grid-12">
          <div style={{ gridColumn: "1/7",  background: "var(--shade)", aspectRatio: "4/5" }} />
          <div style={{ gridColumn: "7/13", background: "var(--shade)", aspectRatio: "4/3" }} />
        </div>
      </div>
    </>
  );
}

function EditorialBody() {
  return (
    <>
      <div className="mini-section">
        <span className="mini-label">01 / Story</span>
        <div className="mini-grid-2" style={{ gridTemplateColumns: "3fr 2fr" }}>
          <div>
            <div className="mini-heading" style={{ width: "85%" }} />
            <div className="mini-heading" style={{ width: "60%", opacity: 0.5 }} />
            <div className="mini-para" />
            <div className="mini-para" style={{ width: "90%" }} />
            <div className="mini-para" style={{ width: "70%" }} />
          </div>
          <div className="mini-photo" style={{ aspectRatio: "4/5" }} />
        </div>
      </div>
      <div className="mini-section">
        <span className="mini-label">02 / Events</span>
        <div className="mini-grid-2" style={{ gap: "2px" }}>
          <div className="mini-card" style={{ padding: "10px" }}>
            <div className="mini-para" style={{ width: "60%" }} />
            <div className="mini-para" style={{ width: "80%" }} />
          </div>
          <div className="mini-card" style={{ padding: "10px" }}>
            <div className="mini-para" style={{ width: "60%" }} />
            <div className="mini-para" style={{ width: "80%" }} />
          </div>
        </div>
      </div>
      <div className="mini-section">
        <div className="mini-masonry">
          <div className="mini-photo" style={{ aspectRatio: "3/4", marginBottom: 3 }} />
          <div className="mini-photo" style={{ aspectRatio: "4/5", marginBottom: 3 }} />
          <div className="mini-photo" style={{ aspectRatio: "1/1", marginBottom: 3 }} />
          <div className="mini-photo" style={{ aspectRatio: "4/5", marginBottom: 3 }} />
          <div className="mini-photo" style={{ aspectRatio: "3/4", marginBottom: 3 }} />
          <div className="mini-photo" style={{ aspectRatio: "1/1", marginBottom: 3 }} />
        </div>
      </div>
    </>
  );
}
