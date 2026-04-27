"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { CoupleData } from "@/lib/types";

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelative(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function InvitationOverview({ couple }: { couple: CoupleData }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cultureLabels = couple.cultures.map((c) =>
    c.subRegion
      ? `${titleCase(c.cultureId)} · ${titleCase(c.subRegion)}`
      : titleCase(c.cultureId)
  );

  async function onConfirmStartOver() {
    setDeleting(true);
    setError(null);
    try {
      const r = await fetch(`/api/couple?id=${couple.id}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start over");
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-canvas text-ink font-sans">
      <div className="mx-auto max-w-[1000px] px-6 pt-10 pb-24 md:px-10 md:pt-16">
        {/* Header */}
        <header className="mb-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <SignOutButton className="veein-meta hover:text-ink transition-colors" />
        </header>

        <div className="mb-8">
          <span className="veein-meta">§ Welcome back</span>
        </div>

        <article
          className="relative bg-paper border border-line p-8 md:p-12"
          style={{ boxShadow: "0 40px 60px -30px rgba(29,26,26,0.18)" }}
        >
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <span className="veein-meta">Issue No. 01 · Your invitation</span>
            <span className="veein-meta text-stone">
              {couple.is_published ? "Published" : "Draft"}
            </span>
          </div>

          <h1 className="font-serif text-5xl leading-[0.95] tracking-[-0.01em] md:text-7xl">
            <span>{couple.person1_name}</span>
            <span className="italic text-blush"> &amp; </span>
            <span>{couple.person2_name}</span>
          </h1>

          <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-serif text-xl text-ink/80">
            <span>{couple.wedding_date || "Date to be set"}</span>
            {couple.venue_name ? (
              <span className="flex items-baseline gap-3">
                <span className="text-stone/40">·</span>
                <span>
                  {couple.venue_name}
                  {couple.venue_city ? `, ${couple.venue_city}` : ""}
                </span>
              </span>
            ) : null}
          </div>

          {(couple.style || cultureLabels.length > 0) && (
            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 veein-meta">
              {couple.style ? (
                <span className="text-ink/80">{couple.style}</span>
              ) : null}
              {cultureLabels.map((label, i) => (
                <span key={`${label}-${i}`} className="flex items-baseline gap-3">
                  {(couple.style || i > 0) && (
                    <span className="text-gold">·</span>
                  )}
                  <span className="text-ink/80">{label}</span>
                </span>
              ))}
            </div>
          )}

          <div className="my-10 flex items-center gap-6">
            <div className="h-px flex-1 bg-line" />
            <span className="veein-meta text-gold">· Vee ·</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6">
              <Link
                href={`/dashboard?couple=${couple.id}&slug=${encodeURIComponent(
                  couple.slug
                )}`}
                className="group inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-medium text-canvas"
              >
                Continue editing
                <span
                  aria-hidden
                  className="inline-block transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="border-b border-stone/40 pb-0.5 text-sm text-stone transition-colors hover:border-blush hover:text-blush"
              >
                Start over
              </button>
            </div>
            {couple.updated_at ? (
              <span className="veein-meta text-stone">
                Last saved {formatRelative(couple.updated_at)}
              </span>
            ) : null}
          </div>
        </article>

        <p className="mt-10 max-w-md veein-meta text-stone">
          Your invitation lives in the studio. Refining the design, ceremonies,
          or RSVP form happens there — not here.
        </p>
      </div>

      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-over-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0 bg-ink/30"
            style={{ backdropFilter: "blur(4px)" }}
          />
          <div className="relative w-full max-w-md border border-line bg-canvas p-8 shadow-2xl">
            <span className="veein-meta">§ Hold on</span>
            <h2
              id="start-over-title"
              className="mt-3 font-serif text-3xl leading-tight"
            >
              Discard your <span className="italic text-blush">current invitation?</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              This deletes everything you&rsquo;ve built so far — the design, the
              cultural ceremonies, the RSVPs, the photos. There&rsquo;s no undo.
            </p>
            {error ? (
              <p className="mt-3 text-sm text-blush">{error}</p>
            ) : null}
            <div className="mt-8 flex items-center justify-end gap-5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="veein-meta text-stone transition-colors hover:text-ink disabled:opacity-60"
              >
                Keep my invitation
              </button>
              <button
                type="button"
                onClick={onConfirmStartOver}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full border border-blush px-5 py-2.5 text-sm font-medium text-blush transition-colors hover:bg-blush hover:text-canvas disabled:opacity-60"
              >
                {deleting ? "Discarding…" : "Yes, start over"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
