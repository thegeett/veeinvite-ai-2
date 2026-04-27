"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { JourneyProgress, type JourneyReachable } from "@/components/journey/JourneyProgress";
import { JourneyFooter } from "@/components/journey/JourneyFooter";
import type { CoupleData } from "@/lib/types";

type Field = "person1_name" | "person2_name" | "wedding_date_iso" | "venue_name" | "venue_city";

type Props = {
  /** Existing couple to prefill from + UPDATE on submit. Null for new users. */
  couple: CoupleData | null;
  /** Reachability flags for the journey progress bar (plan §34.4). */
  reachable: JourneyReachable;
};

export function OnboardingStep1Form({ couple, reachable }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [values, setValues] = useState({
    person1_name: couple?.person1_name ?? "",
    person2_name: couple?.person2_name ?? "",
    wedding_date_iso: couple?.wedding_date_iso?.slice(0, 10) ?? "",
    venue_name: couple?.venue_name ?? "",
    venue_city: couple?.venue_city ?? ""
  });

  // Start-over (delete invitation) state — a quiet, secondary affordance
  // inside Step 1 per plan §34.5 invariant 5.
  const [confirmingStartOver, setConfirmingStartOver] = useState(false);
  const [startingOver, setStartingOver] = useState(false);
  const [startOverError, setStartOverError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const filled = Object.values(values).filter((v) => v.trim().length > 0).length;
    return Math.round((filled / 5) * 100);
  }, [values]);

  function set<K extends Field>(k: K, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!values.person1_name.trim()) next.person1_name = "Add a name.";
    if (!values.person2_name.trim()) next.person2_name = "Add a name.";
    if (!values.wedding_date_iso) next.wedding_date_iso = "Pick a date.";
    if (!values.venue_name.trim()) next.venue_name = "Where is it happening?";
    if (!values.venue_city.trim()) next.venue_city = "Which city?";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSave();
  }

  async function handleSave() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const prettyDate = formatPrettyDate(values.wedding_date_iso);
      const input = {
        person1_name: values.person1_name.trim(),
        person2_name: values.person2_name.trim(),
        wedding_date_iso: values.wedding_date_iso,
        wedding_date: prettyDate,
        venue_name: values.venue_name.trim(),
        venue_city: values.venue_city.trim()
      };

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 1,
          // Pass couple_id when prefilling an existing row so the route
          // does an UPDATE instead of INSERT.
          couple_id: couple?.id,
          answers: input
        })
      });
      if (r.status === 401) {
        router.push(`/auth/login?next=${encodeURIComponent("/onboarding")}`);
        return;
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      const result = (await r.json()) as { couple_id: string; slug: string };

      const params = new URLSearchParams({
        couple: result.couple_id,
        slug: result.slug
      });
      router.push(`/onboarding/step-2?${params.toString()}`);
    } catch (err) {
      console.error(err);
      setErrors({ person1_name: "Something went wrong. Try again." });
      setSubmitting(false);
    }
  }

  async function onConfirmStartOver() {
    if (!couple) return;
    setStartingOver(true);
    setStartOverError(null);
    try {
      const r = await fetch(`/api/couple?id=${couple.id}`, { method: "DELETE" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start over");
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setStartOverError(err instanceof Error ? err.message : String(err));
      setStartingOver(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink relative">
      <div className="mx-auto max-w-[1000px] px-6 pt-10 pb-24 md:px-10 md:pt-16">
        {/* Header — masthead first, journey bar appears below it */}
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <SignOutButton className="veein-meta hover:text-ink transition-colors" />
        </header>
      </div>

      <JourneyProgress
        current={1}
        reachable={reachable}
        coupleId={couple?.id}
        slug={couple?.slug}
      />

      <div className="mx-auto max-w-[1000px] px-6 pt-10 pb-24 md:px-10">
        <div className="mb-12 flex items-center gap-4">
          <div className="h-[2px] flex-1 overflow-hidden bg-line">
            <div
              className="h-full bg-ink transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="veein-meta text-stone">{progress}%</span>
        </div>

        <div className="mb-12 max-w-2xl">
          <div className="veein-meta mb-4">§ The basics</div>
          <h1 className="font-serif text-4xl leading-tight md:text-6xl">
            {couple ? (
              <>
                Update <span className="italic text-blush">the basics.</span>
              </>
            ) : (
              <>
                Let&rsquo;s meet <span className="italic text-blush">the two of you.</span>
              </>
            )}
          </h1>
          <p className="mt-5 text-ink/70 leading-relaxed">
            {couple
              ? "Edit any of the basics — your changes save when you click Continue."
              : "Four quick details. The next step is where we design the site. Everything saves as you go."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2">
          <FieldInput
            label="Your name"
            placeholder="e.g. Priya"
            value={values.person1_name}
            onChange={(v) => set("person1_name", v)}
            error={errors.person1_name}
          />
          <FieldInput
            label="Their name"
            placeholder="e.g. Arjun"
            value={values.person2_name}
            onChange={(v) => set("person2_name", v)}
            error={errors.person2_name}
          />
          <FieldInput
            label="Wedding date"
            type="date"
            value={values.wedding_date_iso}
            onChange={(v) => set("wedding_date_iso", v)}
            error={errors.wedding_date_iso}
          />
          <div />
          <FieldInput
            label="Venue"
            placeholder="e.g. The Leela Palace"
            value={values.venue_name}
            onChange={(v) => set("venue_name", v)}
            error={errors.venue_name}
          />
          <FieldInput
            label="City"
            placeholder="e.g. Udaipur"
            value={values.venue_city}
            onChange={(v) => set("venue_city", v)}
            error={errors.venue_city}
          />

          <div className="md:col-span-2 mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-base font-medium text-canvas disabled:opacity-60"
            >
              {submitting ? "Continuing…" : couple ? "Save and continue" : "See my site"}
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>

        {/* Start over — only for users who already have an invitation. */}
        {couple ? (
          <section className="mt-12 border-t border-line pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="veein-meta text-stone max-w-md">
                Want to discard this invitation and start fresh? You&rsquo;ll
                lose the design, ceremonies, RSVPs and photos.
              </p>
              <button
                type="button"
                onClick={() => setConfirmingStartOver(true)}
                className="border-b border-stone/40 pb-0.5 text-sm text-stone transition-colors hover:border-blush hover:text-blush"
              >
                Start over
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {/* Wizard step navigation — Step 1 has no Previous (entry point); the
          Next mirrors the in-form submit so users have a consistent action
          at the bottom of the page. */}
      <JourneyFooter
        next={{
          type: "submit",
          label: submitting
            ? "Continuing…"
            : couple
              ? "Save and continue"
              : "See my site",
          onClick: handleSave,
          loading: submitting,
          disabled: submitting
        }}
      />

      {/* Start-over confirm dialog */}
      {confirmingStartOver ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="step1-start-over-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0 bg-ink/30"
            style={{ backdropFilter: "blur(4px)" }}
          />
          <div className="relative w-full max-w-md border border-line bg-canvas p-8 shadow-2xl">
            <span className="veein-meta">§ Hold on</span>
            <h2
              id="step1-start-over-title"
              className="mt-3 font-serif text-3xl leading-tight"
            >
              Discard your <span className="italic text-blush">current invitation?</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/70">
              This deletes everything you&rsquo;ve built — the design, the
              cultural ceremonies, the RSVPs, the photos. There&rsquo;s no undo.
            </p>
            {startOverError ? (
              <p className="mt-3 text-sm text-blush">{startOverError}</p>
            ) : null}
            <div className="mt-8 flex items-center justify-end gap-5">
              <button
                type="button"
                onClick={() => setConfirmingStartOver(false)}
                disabled={startingOver}
                className="veein-meta text-stone transition-colors hover:text-ink disabled:opacity-60"
              >
                Keep my invitation
              </button>
              <button
                type="button"
                onClick={onConfirmStartOver}
                disabled={startingOver}
                className="inline-flex items-center gap-2 rounded-full border border-blush px-5 py-2.5 text-sm font-medium text-blush transition-colors hover:bg-blush hover:text-canvas disabled:opacity-60"
              >
                {startingOver ? "Discarding…" : "Yes, start over"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="veein-meta mb-2 block text-stone">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-b border-ink/30 bg-transparent pb-3 font-serif text-2xl text-ink outline-none focus:border-blush transition-colors"
      />
      {error ? <span className="mt-2 block text-sm text-blush">{error}</span> : null}
    </label>
  );
}

function formatPrettyDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}
