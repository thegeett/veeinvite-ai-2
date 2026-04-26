"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { CulturalConfigurator, CultureSelection } from "@/components/onboarding/CulturalConfigurator";
import { StyleCardPicker } from "@/components/onboarding/StyleCardPicker";
import { CompletionIndicator } from "@/components/onboarding/CompletionIndicator";
import { LayoutMini } from "@/components/landing/LayoutMini";
import { SignOutButton } from "@/components/auth/SignOutButton";
// Fixtures intentionally not imported — step 2 commits via /api/generate step 2.
import type { StyleCard } from "@/lib/types";

const STYLE_TO_FLAVOR: Record<StyleCard, "modern" | "romantic" | "grand" | "editorial"> = {
  "Modern Minimalist": "modern",
  "Romantic Traditional": "romantic",
  "Bohemian Garden": "modern",
  "Elegant Minimal": "modern",
  "South Asian Grand": "grand",
  "Destination Glamour": "editorial",
  "Editorial Bold": "editorial"
};

export default function OnboardingStep2Page() {
  return (
    <Suspense fallback={<Loading />}>
      <OnboardingStep2 />
    </Suspense>
  );
}

function Loading() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-[1400px] px-4 pt-8 md:px-8">
        <span className="veein-meta">Loading step 2…</span>
      </div>
    </main>
  );
}

function OnboardingStep2() {
  const params = useSearchParams();
  const router = useRouter();

  const coupleId = params.get("couple");
  const slug = params.get("slug") ?? "your-wedding";
  const p1 = params.get("p1") ?? "You";
  const p2 = params.get("p2") ?? "Them";
  const date = params.get("date") ?? "";
  const venue = params.get("venue") ?? "";
  const city = params.get("city") ?? "";

  const [styleCard, setStyleCard] = useState<StyleCard>();
  const [vibeWords, setVibeWords] = useState("");
  const [story, setStory] = useState("");
  const [selections, setSelections] = useState<CultureSelection[]>([]);
  const [lastApplied, setLastApplied] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flavor = styleCard ? STYLE_TO_FLAVOR[styleCard] : "modern";

  const completion = useMemo(
    () => [
      { label: "Names and date", state: "done" as const },
      { label: "Visual design and layout", state: styleCard ? ("done" as const) : ("partial" as const), action: styleCard ? undefined : "Pick a style →" },
      { label: "RSVP form (ready for guests)", state: "done" as const },
      {
        label: "Ceremonies (from your cultural profile)",
        state: selections.length > 0 ? ("done" as const) : ("partial" as const),
        action: selections.length === 0 ? "Add traditions →" : undefined
      },
      {
        label: "Your story",
        state: story.trim().length > 40 ? ("done" as const) : ("todo" as const),
        action: "Tell us your story →"
      },
      { label: "Photos", state: "todo" as const, action: "Upload when ready" }
    ],
    [styleCard, selections, story]
  );

  const applyEdit = useCallback(
    async (description: string) => {
      // Progressive per-change edits are M2 polish. In M1 we just surface what the
      // couple picked (for confidence) and commit everything on "Open dashboard".
      setApplying(true);
      setLastApplied(description);
      setTimeout(() => setApplying(false), 300);
    },
    []
  );

  async function onFinish() {
    if (!coupleId) {
      router.push("/onboarding");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const answers = {
        styleCard,
        vibeWords: vibeWords
          .split(/[\s,]+/)
          .map((v) => v.trim())
          .filter(Boolean),
        story: story.trim() || undefined,
        cultures: selections,
        contentValues: {},
        events: []
      };

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 2, couple_id: coupleId, answers })
      });

      if (r.status === 401) {
        router.push(`/auth/login?next=${encodeURIComponent("/onboarding/step-2")}`);
        return;
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Update failed");
      }

      router.push(`/dashboard?couple=${coupleId}&slug=${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-28 md:px-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <div className="flex items-center gap-6">
            <SignOutButton className="veein-meta hover:text-ink transition-colors" />
            <span className="veein-meta">Step 2 of 2 · Refine</span>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={onFinish}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-canvas disabled:opacity-60"
              >
                {submitting ? "Generating your site…" : "Open dashboard"}
                <span aria-hidden>→</span>
              </button>
              {error ? (
                <span className="text-xs text-blush">{error}</span>
              ) : null}
            </div>
          </div>
        </header>

        {/* Two-pane layout */}
        <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
          {/* LEFT — refine controls */}
          <div className="space-y-12">
            <section>
              <div className="veein-meta mb-4">§ Your first site</div>
              <h1 className="font-serif text-4xl leading-tight md:text-5xl">
                <span>{p1}</span> &amp; <span>{p2}</span>.{" "}
                <span className="italic text-blush block">Let’s get you closer.</span>
              </h1>
              <p className="mt-4 max-w-xl text-ink/70 leading-relaxed">
                Every answer below refines the preview on the right. No save button —
                changes apply immediately.
              </p>
            </section>

            {/* Style card */}
            <section>
              <StyleCardPicker
                value={styleCard}
                onChange={(s) => {
                  setStyleCard(s);
                  applyEdit(`Style card changed to ${s}`);
                }}
              />
            </section>

            {/* Vibe words */}
            <section>
              <h3 className="font-serif text-2xl mb-1">Three words</h3>
              <p className="text-ink/70 text-sm mb-4">
                How does it feel? (e.g. <em>warm, celebratory, soft</em>)
              </p>
              <input
                type="text"
                value={vibeWords}
                onChange={(e) => setVibeWords(e.target.value)}
                onBlur={() => {
                  if (vibeWords.trim()) applyEdit(`Vibe words: ${vibeWords.trim()}`);
                }}
                placeholder="warm, celebratory, soft"
                className="w-full border-b border-ink/30 bg-transparent pb-2 font-serif text-xl outline-none focus:border-blush transition-colors"
              />
            </section>

            {/* Cultural configurator */}
            <section>
              <CulturalConfigurator
                selections={selections}
                onChange={(next) => {
                  setSelections(next);
                  applyEdit(`Cultural profile: ${next.map((n) => n.cultureId).join(" + ") || "none"}`);
                }}
              />
            </section>

            {/* Story */}
            <section>
              <h3 className="font-serif text-2xl mb-1">Your story</h3>
              <p className="text-ink/70 text-sm mb-4">
                A few lines about how you met or what you love about each other. Edit
                later if nothing comes to mind now.
              </p>
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                onBlur={() => {
                  if (story.trim().length > 10) applyEdit("Story updated");
                }}
                rows={7}
                placeholder={`e.g. We met at a friend’s birthday party in 2021. ${p1} made ${p2} laugh for three hours straight.`}
                className="w-full rounded-md border border-line bg-paper p-4 font-serif text-lg leading-relaxed outline-none focus:border-ink/50"
              />
            </section>

            {/* Finish */}
            <section className="border-t border-line pt-10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl">All set for now?</h3>
                  <p className="text-ink/70 text-sm mt-1 max-w-md">
                    You can keep refining from the dashboard. Nothing published yet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onFinish}
                  disabled={submitting}
                  className="inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-base font-medium text-canvas disabled:opacity-60"
                >
                  {submitting ? "Generating your site…" : "Open dashboard"}
                  <span aria-hidden>→</span>
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT — preview column */}
          <aside className="lg:sticky lg:top-6 space-y-5 h-fit">
            <div className="rounded-md border border-line bg-paper p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="veein-meta">§ Preview</span>
                <div className="flex items-center gap-3">
                  {applying ? (
                    <span className="veein-meta text-blush">• applying…</span>
                  ) : lastApplied ? (
                    <span className="veein-meta text-stone" title={lastApplied}>
                      ✓ up to date
                    </span>
                  ) : null}
                </div>
              </div>
              {/* Placeholder preview — renders a mini schematic in the chosen style */}
              <div className="aspect-[3/4] w-full">
                <LayoutMini flavor={flavor} />
              </div>
              <div className="mt-3 text-sm">
                <p className="font-serif text-lg leading-tight">
                  {p1} &amp; {p2}
                </p>
                <p className="veein-meta text-stone mt-1">
                  {date || "date · "} {venue && ` · ${venue}`} {city && ` · ${city}`}
                </p>
              </div>
              <p className="mt-4 veein-meta text-stone">
                A schematic preview — the real site renders in your dashboard.
              </p>
            </div>

            <CompletionIndicator items={completion} />
          </aside>
        </div>
      </div>
    </main>
  );
}
