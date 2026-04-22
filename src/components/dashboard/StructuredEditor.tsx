'use client';

import { useState } from 'react';
import type { CoupleData } from '@/lib/types';

interface Props {
  couple: CoupleData;
  onUpdate: (updatedSiteUrl?: string | null) => void;
}

interface FieldSpec {
  label: string;
  dbField: string;
  prop: keyof CoupleData;
  type?: 'text' | 'date';
  display?: (v: string | undefined) => string;
}

const FIELDS: FieldSpec[] = [
  { label: 'Your name', dbField: 'person1_name', prop: 'person1Name' },
  { label: "Partner's name", dbField: 'person2_name', prop: 'person2Name' },
  { label: 'Wedding date (display)', dbField: 'wedding_date', prop: 'weddingDate' },
  { label: 'Venue name', dbField: 'venue_name', prop: 'venueName' },
  { label: 'City', dbField: 'venue_city', prop: 'venueCity' },
  { label: 'RSVP deadline', dbField: 'rsvp_deadline', prop: 'rsvpDeadline', type: 'date' },
];

export function StructuredEditor({ couple, onUpdate }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {FIELDS.map((f) => (
        <EditableField key={f.dbField} couple={couple} spec={f} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function EditableField({
  couple,
  spec,
  onUpdate,
}: {
  couple: CoupleData;
  spec: FieldSpec;
  onUpdate: (updatedSiteUrl?: string | null) => void;
}) {
  const initial = (couple[spec.prop] as string | undefined) ?? '';
  const [value, setValue] = useState<string>(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupleId: couple.id,
          field: spec.dbField,
          value,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setEditing(false);
      onUpdate(json?.siteUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(initial);
    setEditing(false);
    setError(null);
  }

  return (
    <div className="rounded-lg border border-cream/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cream/50">
            {spec.label}
          </div>
          {editing ? (
            <input
              autoFocus
              type={spec.type ?? 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') cancel();
              }}
              className="mt-1 w-full rounded-md bg-black/40 border border-cream/20 px-2 py-1 text-cream outline-none focus:border-cream/50"
            />
          ) : (
            <div className="mt-1 text-cream truncate">
              {(initial || '—') as string}
            </div>
          )}
          {error ? <div className="mt-1 text-xs text-red-300">{error}</div> : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="text-xs text-cream hover:underline underline-offset-4"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="text-xs text-cream/50 hover:text-cream"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-cream/60 hover:text-cream"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
