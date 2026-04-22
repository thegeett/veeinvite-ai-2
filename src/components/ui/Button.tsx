'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const BASE =
  'inline-flex items-center justify-center rounded-full font-medium ' +
  'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ' +
  'px-6 py-3 text-sm tracking-wide';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-cream text-ink hover:bg-white active:scale-[0.98]',
  secondary:
    'border border-cream/30 text-cream hover:bg-cream/10 active:scale-[0.98]',
  ghost:
    'text-cream/80 hover:text-cream hover:bg-cream/5',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
