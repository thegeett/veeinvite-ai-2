"use client";

// VibeTagPicker — dual-mode tag picker for onboarding step 2 (PALETTE-01).
//
// Western mode: 12 tags in a 3×4 grid. Tags select the aesthetic family.
// Cultural mode: 8 tags in a 2×4 grid. Tags adjust DesignWeight.
//
// The mode is decided by the caller (it knows the couple's culturalProfile).
// Subheading copy differs by mode — explicit honesty about what the tags
// will and won't change. See `doc/VIBE_TAG_PICKER_SPEC.md`.
//
// Interaction:
//   - Tap unselected tag → selects it.
//   - Tap selected tag → deselects.
//   - 3 tags selected, tap an unselected one → replace the least-recently
//     selected. (No hard cap; 4th tap rotates the oldest out.)
//   - Hover (desktop) / long-press (mobile) → TagPreview opens.
//
// No free-text input. The spec explicitly removed it.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  WESTERN_TAGS,
  CULTURAL_TAGS,
  type WesternTagDefinition,
  type CulturalTagDefinition
} from "@/lib/ai/vibeTagPicker";
import { TagPreview } from "@/components/quiz/TagPreview";

/** Returns true when the user prefers reduced motion. SSR-safe: returns false
 *  if `window` is unavailable. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Approximate column count from viewport width. Matches the Tailwind
 *  `md:grid-cols-4` breakpoint used in the grid below — 4 columns at md+,
 *  2 columns below. Used by arrow-key navigation to compute up/down jumps. */
function gridColumnCount(): number {
  if (typeof window === "undefined") return 4;
  return window.matchMedia("(min-width: 768px)").matches ? 4 : 2;
}

type Mode = "western" | "cultural";

type Props = {
  mode: Mode;
  /** Currently selected tag ids, ordered most-recent-first.
   *  The wrapper component owns this state so it can be persisted +
   *  re-prefilled on edit. */
  selected: string[];
  /** Called with the new ordered selection when the couple taps a tag. */
  onChange: (next: string[]) => void;
};

const MAX_SELECTED = 3;
const LONG_PRESS_MS = 400;
const HOVER_DELAY_MS = 300;

export function VibeTagPicker({ mode, selected, onChange }: Props) {
  const tags = useMemo(
    () => (mode === "western" ? WESTERN_TAGS : CULTURAL_TAGS),
    [mode]
  );
  const limitReached = selected.length >= MAX_SELECTED;

  // Refs for keyboard arrow-key navigation. The grid keydown handler reads
  // the focused index from these and shifts focus.
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Reset the ref array when the tag list length changes (mode flip).
  if (buttonRefs.current.length !== tags.length) {
    buttonRefs.current = new Array(tags.length).fill(null);
  }

  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const active = document.activeElement;
      const idx = buttonRefs.current.findIndex((b) => b === active);
      if (idx < 0) return; // Focus isn't on one of our tags — ignore.

      const cols = gridColumnCount();
      let next = idx;
      switch (e.key) {
        case "ArrowRight":
          next = (idx + 1) % tags.length;
          break;
        case "ArrowLeft":
          next = (idx - 1 + tags.length) % tags.length;
          break;
        case "ArrowDown":
          next = Math.min(idx + cols, tags.length - 1);
          break;
        case "ArrowUp":
          next = Math.max(idx - cols, 0);
          break;
        default:
          return;
      }
      e.preventDefault();
      buttonRefs.current[next]?.focus();
    },
    [tags.length]
  );

  function toggle(id: string) {
    const idx = selected.indexOf(id);
    if (idx >= 0) {
      // Already selected — deselect.
      const next = selected.filter((s) => s !== id);
      onChange(next);
      return;
    }
    if (selected.length < MAX_SELECTED) {
      // Room left — append at the front (most-recent-first ordering).
      onChange([id, ...selected]);
      return;
    }
    // At limit — rotate the oldest (last entry) out, prepend the new one.
    const rotated = [id, ...selected.slice(0, MAX_SELECTED - 1)];
    onChange(rotated);
  }

  return (
    <section aria-labelledby={`vibe-${mode}-heading`}>
      <h3
        id={`vibe-${mode}-heading`}
        className="font-serif text-2xl mb-1"
      >
        How should your invitation feel?
      </h3>
      <p className="text-ink/70 text-sm mb-4">
        {mode === "western"
          ? "Choose up to 3 — we'll use these to pick your color palette."
          : "Choose up to 3 — we'll use these to set the tone and decoration."}
      </p>

      <div
        role="group"
        aria-label="Vibe tag picker"
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
        onKeyDown={onGridKeyDown}
      >
        {/* Branch on mode so the discriminated union resolves correctly —
            TagButton's mode + tag pair must be either both western or both
            cultural, not either-or under a wider type. */}
        {mode === "western"
          ? (tags as typeof WESTERN_TAGS).map((tag, i) => (
              <TagButton
                key={tag.id}
                mode="western"
                tag={tag}
                isSelected={selected.includes(tag.id)}
                isDimmed={limitReached && !selected.includes(tag.id)}
                onToggle={() => toggle(tag.id)}
                buttonRef={(el) => {
                  buttonRefs.current[i] = el;
                }}
              />
            ))
          : (tags as typeof CULTURAL_TAGS).map((tag, i) => (
              <TagButton
                key={tag.id}
                mode="cultural"
                tag={tag}
                isSelected={selected.includes(tag.id)}
                isDimmed={limitReached && !selected.includes(tag.id)}
                onToggle={() => toggle(tag.id)}
                buttonRef={(el) => {
                  buttonRefs.current[i] = el;
                }}
              />
            ))}
      </div>
    </section>
  );
}

// ============================================================================
// Single tag button + its hover/long-press preview
// ============================================================================

type TagButtonProps =
  | {
      mode: "western";
      tag: WesternTagDefinition;
      isSelected: boolean;
      isDimmed: boolean;
      onToggle: () => void;
      buttonRef: (el: HTMLButtonElement | null) => void;
    }
  | {
      mode: "cultural";
      tag: CulturalTagDefinition;
      isSelected: boolean;
      isDimmed: boolean;
      onToggle: () => void;
      buttonRef: (el: HTMLButtonElement | null) => void;
    };

function TagButton(props: TagButtonProps) {
  const { tag, isSelected, isDimmed, onToggle, buttonRef } = props;
  const [previewOpen, setPreviewOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelId = useId();

  function clearTimers() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    hoverTimer.current = null;
    longPressTimer.current = null;
  }
  useEffect(() => () => clearTimers(), []);

  function handleEnter() {
    clearTimers();
    // F2: respect reduced-motion preference — preview appears instantly,
    // no 300ms anticipation delay.
    const delay = prefersReducedMotion() ? 0 : HOVER_DELAY_MS;
    if (delay === 0) {
      setPreviewOpen(true);
    } else {
      hoverTimer.current = setTimeout(() => setPreviewOpen(true), delay);
    }
  }
  function handleLeave() {
    clearTimers();
    setPreviewOpen(false);
  }
  function handleTouchStart() {
    clearTimers();
    // Long-press is a deliberate gesture, not a transition — keep its
    // duration even under reduced-motion. Otherwise users couldn't tell
    // the long-press apart from a tap.
    longPressTimer.current = setTimeout(() => setPreviewOpen(true), LONG_PRESS_MS);
  }
  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Hide on touch release. The selection happens on click which fires
    // independently of touchend.
    setPreviewOpen(false);
  }

  // F2: motion-safe variant gates the transition behind the reduced-motion
  // media query. Tailwind ships `motion-safe:` out of the box.
  const baseClasses =
    "relative inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-sm font-medium motion-safe:transition-colors";
  const stateClasses = isSelected
    ? "border-blush text-blush bg-blush/[0.08]"
    : isDimmed
      ? "border-line text-ink/40 hover:text-ink/60"
      : "border-line text-ink/70 hover:text-ink";

  return (
    <span
      ref={wrapperRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-pressed={isSelected}
        aria-describedby={labelId}
        onClick={onToggle}
        className={`${baseClasses} ${stateClasses}`}
      >
        {tag.label}
      </button>
      <span id={labelId} className="sr-only">
        {tag.label} —{" "}
        {props.mode === "western"
          ? props.tag.preview.keywords
          : props.tag.description}
      </span>
      {previewOpen ? (
        <span
          className="absolute left-1/2 z-40 mt-2 -translate-x-1/2"
          style={{ top: "100%" }}
        >
          {props.mode === "western" ? (
            <TagPreview mode="western" tag={props.tag} />
          ) : (
            <TagPreview mode="cultural" tag={props.tag} />
          )}
        </span>
      ) : null}
    </span>
  );
}
