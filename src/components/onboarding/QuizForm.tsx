'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

interface QuizState {
  person1: string;
  person2: string;
  date: string;
  venueName: string;
  venueCity: string;
  style: string;
  vibe: string;
  story: string;
  cultural: string;
  events: EventRow[];
}

interface EventRow {
  name: string;
  date: string;
  time: string;
  venue: string;
}

const STYLE_OPTIONS: { id: string; title: string; blurb: string }[] = [
  { id: 'Modern Minimalist', title: 'Modern Minimalist', blurb: 'Clean lines, white space, sophisticated.' },
  { id: 'Romantic Traditional', title: 'Romantic Traditional', blurb: 'Timeless elegance, warm and classic.' },
  { id: 'Bohemian Garden', title: 'Bohemian Garden', blurb: 'Natural, earthy, free-spirited.' },
  { id: 'South Asian Luxury', title: 'South Asian Luxury', blurb: 'Rich colours, grand celebration.' },
  { id: 'Destination Glamour', title: 'Destination Glamour', blurb: 'Cinematic, dramatic, luxurious.' },
  { id: 'Elegant Minimal', title: 'Elegant Minimal', blurb: 'Understated refinement, less is more.' },
];

const BLANK_EVENT: EventRow = { name: '', date: '', time: '', venue: '' };

function slugify(person1: string, person2: string): string {
  const base = `${person1} ${person2}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return base || 'wedding';
}

function randomSuffix() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function QuizForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(0);
  const [state, setState] = useState<QuizState>({
    person1: '',
    person2: '',
    date: '',
    venueName: '',
    venueCity: '',
    style: '',
    vibe: '',
    story: '',
    cultural: '',
    events: [{ ...BLANK_EVENT }],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof QuizState>(key: K, value: QuizState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function updateEvent(i: number, patch: Partial<EventRow>) {
    setState((s) => {
      const next = [...s.events];
      next[i] = { ...next[i], ...patch };
      return { ...s, events: next };
    });
  }

  function addEvent() {
    setState((s) => {
      if (s.events.length >= 5) return s;
      return { ...s, events: [...s.events, { ...BLANK_EVENT }] };
    });
  }

  function removeEvent(i: number) {
    setState((s) => {
      if (s.events.length <= 1) return s;
      const next = s.events.filter((_, idx) => idx !== i);
      return { ...s, events: next };
    });
  }

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return !!state.person1.trim() && !!state.person2.trim();
      case 1:
        return !!state.date && !!state.venueName.trim() && !!state.venueCity.trim();
      case 2:
        return !!state.style;
      case 3:
        return !!state.vibe.trim();
      case 4:
        return state.events.every(
          (e) => e.name.trim() && e.date && e.time.trim() && e.venue.trim(),
        );
      case 5:
        return !!state.story.trim();
      default:
        return false;
    }
  };

  async function createUniqueSlug(firstName1: string, firstName2: string): Promise<string> {
    const p1 = firstName1.split(' ')[0] || 'us';
    const p2 = firstName2.split(' ')[0] || 'you';
    let slug = slugify(p1, p2);
    let attempts = 0;
    while (attempts < 5) {
      const { data } = await supabase
        .from('couples')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) return slug;
      slug = `${slugify(p1, p2)}-${randomSuffix()}`;
      attempts++;
    }
    return `${slugify(p1, p2)}-${randomSuffix()}`;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const slug = await createUniqueSlug(state.person1, state.person2);
      const weddingDateDisplay = formatDateDisplay(state.date);
      const weddingDateIso = new Date(state.date + 'T16:00:00Z').toISOString();

      const { data: coupleInsert, error: coupleErr } = await supabase
        .from('couples')
        .insert({
          user_id: userId,
          slug,
          person1_name: state.person1.trim(),
          person2_name: state.person2.trim(),
          wedding_date: weddingDateDisplay,
          wedding_date_iso: weddingDateIso,
          venue_name: state.venueName.trim(),
          venue_city: state.venueCity.trim(),
          style: state.style,
          vibe: state.vibe.trim(),
          story: state.story.trim(),
          cultural_context: state.cultural.trim() || null,
          style_history: [],
          is_published: false,
        })
        .select()
        .single();
      if (coupleErr || !coupleInsert) {
        throw new Error(coupleErr?.message || 'Failed to save couple.');
      }

      const coupleId = coupleInsert.id as string;

      const eventRows = state.events.map((e, i) => ({
        couple_id: coupleId,
        name: e.name.trim(),
        event_date: formatDateDisplay(e.date),
        event_time: e.time.trim(),
        venue: e.venue.trim(),
        sort_order: i,
      }));
      const { error: eventsErr } = await supabase.from('events').insert(eventRows);
      if (eventsErr) throw new Error(eventsErr.message);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupleId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Generation failed.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {submitting ? <LoadingScreen show /> : null}

      <header className="px-8 py-6 flex items-center justify-between border-b border-cream/10">
        <span className="font-serif text-lg tracking-wider">VeeInvite</span>
        <span className="text-xs uppercase tracking-[0.2em] text-cream/60">
          Step {step + 1} of 6
        </span>
      </header>

      <div className="flex-1 grid place-items-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <Progress step={step} />

          <div className="mt-10">
            {step === 0 ? <StepNames state={state} update={update} /> : null}
            {step === 1 ? <StepDate state={state} update={update} /> : null}
            {step === 2 ? <StepStyle state={state} update={update} /> : null}
            {step === 3 ? <StepVibe state={state} update={update} /> : null}
            {step === 4 ? (
              <StepEvents
                state={state}
                updateEvent={updateEvent}
                addEvent={addEvent}
                removeEvent={removeEvent}
              />
            ) : null}
            {step === 5 ? <StepStory state={state} update={update} /> : null}
          </div>

          {error ? (
            <div className="mt-6 rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">
              {error}
              <button
                type="button"
                onClick={() => submit()}
                className="ml-3 underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          ) : null}

          <div className="mt-10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-sm text-cream/60 hover:text-cream disabled:opacity-30"
            >
              ← Back
            </button>
            {step < 5 ? (
              <Button
                onClick={() => canAdvance() && setStep((s) => s + 1)}
                disabled={!canAdvance()}
              >
                Next →
              </Button>
            ) : (
              <Button
                onClick={() => canAdvance() && submit()}
                disabled={!canAdvance() || submitting}
              >
                Create our website →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------- Progress ----------

function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={`h-[3px] flex-1 rounded-full transition ${
            i <= step ? 'bg-cream' : 'bg-cream/15'
          }`}
        />
      ))}
    </div>
  );
}

// ---------- Steps ----------

type StepProps = {
  state: QuizState;
  update: <K extends keyof QuizState>(key: K, value: QuizState[K]) => void;
};

function Heading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <span className="text-xs uppercase tracking-[0.25em] text-cream/50">{eyebrow}</span>
      ) : null}
      <h1 className="mt-2 font-serif text-4xl">{title}</h1>
      {sub ? <p className="mt-2 text-cream/60">{sub}</p> : null}
    </div>
  );
}

function StepNames({ state, update }: StepProps) {
  return (
    <div>
      <Heading eyebrow="Let's begin" title="Who's getting married?" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Your name"
          placeholder="First name"
          value={state.person1}
          onChange={(e) => update('person1', e.target.value)}
        />
        <Input
          label="Partner's name"
          placeholder="First name"
          value={state.person2}
          onChange={(e) => update('person2', e.target.value)}
        />
      </div>
    </div>
  );
}

function StepDate({ state, update }: StepProps) {
  return (
    <div>
      <Heading eyebrow="The big day" title="When and where?" />
      <div className="flex flex-col gap-4">
        <Input
          label="Wedding date"
          type="date"
          value={state.date}
          onChange={(e) => update('date', e.target.value)}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Venue name"
            placeholder="Kew Gardens"
            value={state.venueName}
            onChange={(e) => update('venueName', e.target.value)}
          />
          <Input
            label="City"
            placeholder="London"
            value={state.venueCity}
            onChange={(e) => update('venueCity', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function StepStyle({ state, update }: StepProps) {
  return (
    <div>
      <Heading eyebrow="Your aesthetic" title="Pick a starting style" sub="Your designer can remix from here." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {STYLE_OPTIONS.map((opt) => {
          const active = state.style === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => update('style', opt.id)}
              className={`text-left rounded-xl border p-5 transition ${
                active
                  ? 'border-cream bg-cream/5'
                  : 'border-cream/15 hover:border-cream/40'
              }`}
            >
              <div className="font-serif text-lg">{opt.title}</div>
              <div className="mt-1 text-sm text-cream/60">{opt.blurb}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepVibe({ state, update }: StepProps) {
  return (
    <div>
      <Heading eyebrow="The feeling" title="Your vibe in three words" sub="This informs the entire visual identity." />
      <Input
        label="Three words"
        placeholder="romantic, grand, intimate"
        value={state.vibe}
        onChange={(e) => update('vibe', e.target.value)}
      />
    </div>
  );
}

function StepEvents({
  state,
  updateEvent,
  addEvent,
  removeEvent,
}: {
  state: QuizState;
  updateEvent: (i: number, patch: Partial<EventRow>) => void;
  addEvent: () => void;
  removeEvent: (i: number) => void;
}) {
  return (
    <div>
      <Heading eyebrow="The schedule" title="What's happening?" sub="Up to five events — ceremony, reception, after party..." />
      <div className="flex flex-col gap-4">
        {state.events.map((e, i) => (
          <div
            key={i}
            className="rounded-xl border border-cream/15 p-5 flex flex-col gap-3 relative"
          >
            {i > 0 ? (
              <button
                type="button"
                onClick={() => removeEvent(i)}
                className="absolute top-3 right-4 text-xs text-cream/50 hover:text-cream"
              >
                Remove
              </button>
            ) : null}
            <Input
              label="Event name"
              placeholder="Ceremony"
              value={e.name}
              onChange={(ev) => updateEvent(i, { name: ev.target.value })}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Date"
                type="date"
                value={e.date}
                onChange={(ev) => updateEvent(i, { date: ev.target.value })}
              />
              <Input
                label="Time"
                placeholder="2:00 PM"
                value={e.time}
                onChange={(ev) => updateEvent(i, { time: ev.target.value })}
              />
            </div>
            <Input
              label="Venue"
              placeholder="Kew Gardens — The Lawn"
              value={e.venue}
              onChange={(ev) => updateEvent(i, { venue: ev.target.value })}
            />
          </div>
        ))}
        {state.events.length < 5 ? (
          <button
            type="button"
            onClick={addEvent}
            className="self-start text-sm text-cream/70 hover:text-cream"
          >
            + Add event
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StepStory({ state, update }: StepProps) {
  return (
    <div>
      <Heading eyebrow="Your story" title="Tell us how you got here" sub="Two or three honest sentences is enough — this shapes the copy." />
      <div className="flex flex-col gap-4">
        <Textarea
          label="Your story"
          rows={5}
          placeholder="How did you meet? When did you know? What makes your love unique?"
          value={state.story}
          onChange={(e) => update('story', e.target.value)}
        />
        <Input
          label="Cultural background (optional)"
          placeholder="e.g. Indian, British, Nigerian..."
          value={state.cultural}
          onChange={(e) => update('cultural', e.target.value)}
        />
      </div>
    </div>
  );
}
