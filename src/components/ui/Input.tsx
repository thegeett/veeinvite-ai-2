'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

const FIELD =
  'w-full rounded-lg border border-cream/15 bg-black/30 px-4 py-3 text-cream ' +
  'placeholder:text-cream/40 outline-none focus:border-cream/40 transition';

export function Input({ label, className = '', ...rest }: InputProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-cream/60">
          {label}
        </span>
      ) : null}
      <input className={`${FIELD} ${className}`} {...rest} />
    </label>
  );
}

export function Textarea({ label, className = '', ...rest }: TextareaProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-cream/60">
          {label}
        </span>
      ) : null}
      <textarea className={`${FIELD} ${className}`} {...rest} />
    </label>
  );
}
