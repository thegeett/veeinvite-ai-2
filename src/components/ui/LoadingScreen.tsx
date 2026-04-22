'use client';

import { useEffect, useState } from 'react';

const MESSAGES: { at: number; text: string }[] = [
  { at: 0, text: 'Reading your story...' },
  { at: 3000, text: 'Designing your palette...' },
  { at: 6000, text: 'Building your site...' },
  { at: 10000, text: 'Almost ready...' },
];

interface Props {
  /** When true, the overlay is visible. */
  show?: boolean;
  /** When provided, overrides the cycling messages. */
  staticText?: string;
  /** When true, renders without the full-screen backdrop (inline / iframe overlay). */
  inline?: boolean;
}

export function LoadingScreen({ show = true, staticText, inline = false }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!show || staticText) return;
    setIdx(0);
    const timers = MESSAGES.map((m, i) =>
      setTimeout(() => setIdx(i), m.at),
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [show, staticText]);

  if (!show) return null;

  const text = staticText ?? MESSAGES[idx].text;

  return (
    <div
      className={
        inline
          ? 'absolute inset-0 flex items-center justify-center bg-ink/80 backdrop-blur-sm z-20'
          : 'fixed inset-0 flex items-center justify-center bg-ink z-50'
      }
    >
      <div className="flex flex-col items-center gap-6 text-center px-6">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border border-cream/20" />
          <div className="absolute inset-0 h-16 w-16 rounded-full border-t border-cream animate-spin" />
        </div>
        <p className="text-cream/80 text-sm tracking-wide">{text}</p>
      </div>
    </div>
  );
}
