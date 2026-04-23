"use client";

import { useState } from "react";
import type { PickedElement } from "./SitePreview";
import { editSite, USE_FIXTURES } from "@/lib/fixtures/api";

const SUGGESTED_PROMPTS = [
  { label: "Make it more romantic", kind: "design" },
  { label: "Use a lighter palette", kind: "design" },
  { label: "Add gold accents", kind: "design" },
  { label: "Make the hero more dramatic", kind: "hero" },
  { label: "Rewrite our story", kind: "content" },
  { label: "Start fresh with a new style", kind: "global" }
] as const;

type SentMessage = {
  id: string;
  instruction: string;
  picked?: string;
  classification?: string;
  at: string;
  state: "sending" | "applied" | "error";
};

type Props = {
  coupleId: string;
  picked: PickedElement;
  onClearPick: () => void;
};

/**
 * Chat pane for plain-English edits. Plan §12 + §30.
 * Classifier runs server-side; the response would include the edit type
 * (data/content/hero/design/global/new_section). In fixture mode we tag the
 * kind of each suggested prompt locally so the UI can show the right "applying"
 * copy without the Haiku round-trip.
 */
export function EditPanel({ coupleId, picked, onClearPick }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SentMessage[]>([]);

  async function send(instruction: string, kind?: string) {
    if (!instruction.trim()) return;
    const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const picketKey = picked?.key;
    const at = new Date().toLocaleTimeString();
    const entry: SentMessage = {
      id,
      instruction,
      picked: picked?.label,
      classification: kind,
      at,
      state: "sending"
    };
    setMessages((m) => [entry, ...m]);
    setInput("");
    onClearPick();

    try {
      const input = {
        coupleId,
        instruction,
        contentPickerTarget: picketKey
      };
      if (process.env.NODE_ENV === "development" && USE_FIXTURES) {
        await editSite(input);
      } else {
        await fetch("/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
      }
      setMessages((m) =>
        m.map((x) => (x.id === id ? { ...x, state: "applied" } : x))
      );
    } catch (err) {
      setMessages((m) =>
        m.map((x) => (x.id === id ? { ...x, state: "error" } : x))
      );
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div className="veein-meta mb-2 text-stone">§ Edit · plain English</div>
        <p className="text-sm text-ink/70">
          Type what you want. Behind the scenes we classify the request and run only the
          calls we need.
        </p>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => send(p.label, p.kind)}
            className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink/80 hover:border-ink/40"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Context chip */}
      {picked ? (
        <div className="flex items-center gap-2 self-start rounded-full bg-blush/10 border border-blush/40 px-3 py-1 text-sm">
          <span className="veein-meta text-blush">Context</span>
          <span>{picked.label}</span>
          <button
            type="button"
            onClick={onClearPick}
            className="text-blush/70 hover:text-blush"
            aria-label="Clear context"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 rounded-md border border-line bg-paper p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            picked ? `Change ${picked.label.toLowerCase()} to…` : "e.g. soften the colours"
          }
          className="flex-1 bg-transparent px-2 py-2 text-base outline-none"
        />
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas"
        >
          Apply
        </button>
      </form>

      {/* History */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="veein-meta mt-6 text-stone">No edits yet. Try a chip above.</p>
        ) : (
          <ul className="space-y-3 mt-2">
            {messages.map((m) => (
              <li key={m.id} className="rounded-md border border-line bg-paper/50 p-3">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="veein-meta">
                    {m.state === "sending"
                      ? "• applying…"
                      : m.state === "applied"
                      ? "✓ applied"
                      : "⚠ failed"}
                    {m.classification ? ` · ${m.classification}` : ""}
                  </span>
                  <span className="text-xs text-stone">{m.at}</span>
                </div>
                <p className="text-sm">{m.instruction}</p>
                {m.picked ? (
                  <p className="text-xs text-stone mt-1">on {m.picked}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
