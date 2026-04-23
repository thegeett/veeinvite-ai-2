"use client";

import { useState } from "react";
import type { CoupleData } from "@/lib/types";

// Fields that live directly on the `couples` row and can be patched via
// /api/structured's `couple` key. Other shapes (rsvp_config, events) have
// dedicated editors elsewhere in the dashboard.
const COUPLE_FIELDS = new Set<keyof CoupleData>([
  "person1_name",
  "person2_name",
  "wedding_date",
  "wedding_date_iso",
  "venue_name",
  "venue_city",
  "rsvp_deadline",
  "story"
]);

type Props = {
  couple: Partial<CoupleData>;
  onSaved?: (next: Partial<CoupleData>) => void;
};

/**
 * Direct (no AI) editing of the canonical couple row. Plan §9, §12: data edits are
 * a one-shot DB update + HTML re-inject, no Call 2 or Call 3. Fast feedback.
 */
export function StructuredEditor({ couple, onSaved }: Props) {
  const [values, setValues] = useState<Partial<CoupleData>>(couple);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save(field: keyof CoupleData, value: string) {
    if (!couple.id) return;
    setSavingField(field);
    try {
      const patch = COUPLE_FIELDS.has(field) ? { couple: { [field]: value } } : {};
      await fetch("/api/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple_id: couple.id, ...patch })
      });
      setSavedAt(new Date().toLocaleTimeString());
      onSaved?.(values);
    } finally {
      setSavingField(null);
    }
  }

  function bind<K extends keyof CoupleData>(field: K): {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur: () => void;
  } {
    const raw = values[field];
    return {
      value: typeof raw === "string" ? raw : raw == null ? "" : String(raw),
      onChange: (e) => setValues({ ...values, [field]: e.target.value }),
      onBlur: () => save(field, (values[field] as string) ?? "")
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="veein-meta mb-2 text-stone">§ Structured edit · no AI</div>
        <p className="text-sm text-ink/70">
          Names, date, venue, RSVP deadline — instant updates. No generation round-trip.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldText label="Your name" {...bind("person1_name")} loading={savingField === "person1_name"} />
        <FieldText label="Their name" {...bind("person2_name")} loading={savingField === "person2_name"} />
        <FieldText label="Wedding date (pretty)" {...bind("wedding_date")} loading={savingField === "wedding_date"} />
        <FieldText label="RSVP deadline" {...bind("rsvp_deadline")} loading={savingField === "rsvp_deadline"} />
        <FieldText label="Venue" {...bind("venue_name")} loading={savingField === "venue_name"} />
        <FieldText label="City" {...bind("venue_city")} loading={savingField === "venue_city"} />
      </div>

      <FieldTextarea label="Your story" rows={6} {...bind("story")} loading={savingField === "story"} />

      {savedAt ? (
        <p className="veein-meta text-stone">✓ saved at {savedAt}</p>
      ) : null}
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  onBlur,
  loading
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  loading: boolean;
}) {
  return (
    <label className="block">
      <span className="veein-meta mb-1 flex items-center justify-between text-stone">
        <span>{label}</span>
        {loading ? <span className="text-blush">• saving</span> : null}
      </span>
      <input
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className="w-full border-b border-ink/30 bg-transparent pb-2 font-serif text-lg outline-none focus:border-blush transition-colors"
      />
    </label>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  onBlur,
  loading,
  rows = 4
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  loading: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="veein-meta mb-1 flex items-center justify-between text-stone">
        <span>{label}</span>
        {loading ? <span className="text-blush">• saving</span> : null}
      </span>
      <textarea
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        rows={rows}
        className="w-full rounded-md border border-line bg-paper p-3 font-serif text-base outline-none focus:border-ink/50"
      />
    </label>
  );
}
