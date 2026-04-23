"use client";

import { useState } from "react";

type Mode = "login" | "signup";

/**
 * UI-only auth form. Stream C wires the real server action.
 * When Stream C's endpoint lands, swap the fake submit handler for a server action import
 * and call it on submit.
 */
export default function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);
    // Fake a round-trip — Stream C replaces this with a real auth action.
    await new Promise((r) => setTimeout(r, 450));
    setNotice(
      mode === "login"
        ? "Check your email for a magic link — stream C wires this in."
        : "Sign-up captured — confirmation flow is wired by Stream C."
    );
    setSubmitting(false);
  }

  const cta = mode === "login" ? "Send me a link" : "Create my account";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <label className="block">
        <span className="veein-meta mb-2 block text-stone">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border-b border-ink/30 bg-transparent pb-3 font-serif text-2xl outline-none focus:border-blush transition-colors"
        />
      </label>

      {mode === "signup" ? (
        <label className="block">
          <span className="veein-meta mb-2 block text-stone">Password (optional — magic link works too)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Pick a strong one"
            className="w-full border-b border-ink/30 bg-transparent pb-3 font-serif text-xl outline-none focus:border-blush transition-colors"
          />
        </label>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-medium text-canvas disabled:opacity-60"
      >
        {submitting ? "Working…" : cta}
        <span aria-hidden>→</span>
      </button>

      {notice ? (
        <p className="veein-meta text-stone">{notice}</p>
      ) : null}
    </form>
  );
}
