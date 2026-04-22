'use client';

import { useState } from 'react';

interface Props {
  coupleId: string;
  history: string[];
  onEdit: (siteUrl: string) => void;
  onHistoryChange: (next: string[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

export function EditPanel({ coupleId, history, onEdit, onHistoryChange, onLoadingChange }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const instruction = input.trim();
    if (!instruction || loading) return;
    setLoading(true);
    onLoadingChange(true);
    setError(null);
    try {
      // Optimistically append to the history so the user sees their message.
      onHistoryChange([...history, instruction]);

      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupleId, instruction }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Edit failed');
      if (json?.siteUrl) onEdit(json.siteUrl);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed');
      // Roll back the optimistic append.
      onHistoryChange(history);
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {history.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-48 overflow-auto pr-1">
          {history.map((h, i) => (
            <div
              key={i}
              className="rounded-lg border border-cream/10 bg-cream/[0.02] px-3 py-2 text-sm text-cream/80"
            >
              {h}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-cream/50 italic">
          Ask for any change — palette, fonts, mood, copy.
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="e.g. Make it more romantic with warmer tones"
          className="w-full rounded-lg border border-cream/15 bg-black/30 px-3 py-2 text-sm text-cream placeholder:text-cream/40 outline-none focus:border-cream/40"
          disabled={loading}
        />
        {error ? <div className="text-xs text-red-300">{error}</div> : null}
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="self-start rounded-full bg-cream text-ink px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-white"
        >
          {loading ? 'Redesigning...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
