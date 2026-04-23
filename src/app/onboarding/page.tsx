"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
// Fixtures intentionally not imported — onboarding always hits the real API.

type Field = "person1_name" | "person2_name" | "wedding_date_iso" | "venue_name" | "venue_city";

export default function OnboardingStep1() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [values, setValues] = useState({
    person1_name: "",
    person2_name: "",
    wedding_date_iso: "",
    venue_name: "",
    venue_city: ""
  });

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
        body: JSON.stringify({ step: 1, answers: input })
      });
      if (r.status === 401) {
        router.push(`/auth/login?next=${encodeURIComponent("/onboarding")}`);
        return;
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Generation failed");
      }
      const result = (await r.json()) as { couple_id: string; slug: string };

      const params = new URLSearchParams({
        couple: result.couple_id,
        slug: result.slug,
        p1: input.person1_name,
        p2: input.person2_name,
        date: prettyDate,
        venue: input.venue_name,
        city: input.venue_city
      });
      router.push(`/onboarding/step-2?${params.toString()}`);
    } catch (err) {
      console.error(err);
      setErrors({ person1_name: "Something went wrong. Try again." });
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink relative">
      <div className="mx-auto max-w-[1000px] px-6 pt-10 pb-24 md:px-10 md:pt-16">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <span className="veein-meta">Step 1 of 2</span>
        </header>

        <div className="mb-12 flex items-center gap-4">
          <div className="h-[2px] flex-1 overflow-hidden bg-line">
            <div
              className="h-full bg-ink transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="veein-meta text-stone">{progress}%</span>
        </div>

        {/* Intro */}
        <div className="mb-12 max-w-2xl">
          <div className="veein-meta mb-4">§ The first 30 seconds</div>
          <h1 className="font-serif text-4xl leading-tight md:text-6xl">
            Let’s meet <span className="italic text-blush">the two of you.</span>
          </h1>
          <p className="mt-5 text-ink/70 leading-relaxed">
            Four quick details. Your site appears on the next screen — real, styled,
            and ready. Everything after that is refinement.
          </p>
        </div>

        {/* Form */}
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

          <div className="md:col-span-2 mt-6 flex items-center justify-between gap-4">
            <p className="veein-meta max-w-xs text-stone">
              Prefer to sign in first? Your site will attach automatically.{" "}
              <Link href="/auth/login" className="text-ink underline">
                Sign in
              </Link>
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-base font-medium text-canvas disabled:opacity-60"
            >
              {submitting ? "Generating your site…" : "See my site"}
              <span aria-hidden>→</span>
            </button>
          </div>
        </form>
      </div>
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
  // "2026-11-14" → "Saturday, 14 November 2026"
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}
