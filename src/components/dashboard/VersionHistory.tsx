"use client";

import { useEffect, useState } from "react";
import { loadVersions, USE_FIXTURES } from "@/lib/fixtures/api";
import type { SiteVersion } from "@/lib/types";

type Props = { coupleId: string };

/**
 * "Your designs" — version history panel (plan §11).
 * Each row shows the couple-friendly label/instruction + "Switch to this design" action.
 * Never uses the word "Restore" (§11 UX language table).
 */
export function VersionHistory({ coupleId }: Props) {
  const [versions, setVersions] = useState<SiteVersion[] | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (process.env.NODE_ENV === "development" && USE_FIXTURES) {
        const data = await loadVersions(coupleId);
        if (!cancelled) setVersions(data);
      } else {
        const r = await fetch(`/api/versions?coupleId=${coupleId}`);
        if (r.ok && !cancelled) setVersions(await r.json());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coupleId]);

  async function switchTo(versionId: string) {
    setSwitching(versionId);
    try {
      if (process.env.NODE_ENV === "development" && USE_FIXTURES) {
        await new Promise((r) => setTimeout(r, 400));
      } else {
        await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coupleId, versionId })
        });
      }
      // Refresh list
      if (process.env.NODE_ENV === "development" && USE_FIXTURES) {
        const data = await loadVersions(coupleId);
        setVersions(data);
      } else {
        const r = await fetch(`/api/versions?coupleId=${coupleId}`);
        if (r.ok) setVersions(await r.json());
      }
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="veein-meta mb-2 text-stone">§ Your designs</div>
        <p className="text-sm text-ink/70">
          Every generation is saved. Switch back to any previous look — the real couple
          details (names, date, venue) always come with you.
        </p>
      </div>

      {versions === null ? (
        <p className="veein-meta text-stone">Loading your designs…</p>
      ) : versions.length === 0 ? (
        <p className="veein-meta text-stone">No designs yet.</p>
      ) : (
        <ul className="space-y-3">
          {versions.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-4 rounded-md border border-line bg-paper p-4">
              <div className="flex items-start gap-4 min-w-0">
                <VersionThumb accent={v.theme_json.globalTokens.accent} bg={v.theme_json.globalTokens.bgPrimary} />
                <div className="min-w-0">
                  <div className="font-serif text-lg leading-tight">
                    {v.label ?? `Design from ${new Date(v.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`}
                  </div>
                  {v.instruction ? (
                    <div className="text-sm text-ink/70 mt-0.5 truncate">
                      “{v.instruction}”
                    </div>
                  ) : null}
                  <div className="veein-meta text-stone mt-1">
                    v{v.version_number} · {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => switchTo(v.id)}
                disabled={switching === v.id}
                className="shrink-0 rounded-full border border-ink px-4 py-1.5 text-sm hover:bg-ink hover:text-canvas transition-colors disabled:opacity-60"
              >
                {switching === v.id ? "Switching…" : "Switch to this design"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VersionThumb({ accent, bg }: { accent: string; bg: string }) {
  return (
    <div
      className="h-16 w-12 shrink-0 rounded-sm border border-line"
      style={{ background: bg }}
      aria-hidden
    >
      <div className="h-full w-full flex items-end justify-center pb-2">
        <span
          className="inline-block h-1.5 w-7 rounded-full"
          style={{ background: accent }}
        />
      </div>
    </div>
  );
}
