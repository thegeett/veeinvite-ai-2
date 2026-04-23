"use client";

import { useState } from "react";
import { login, signup } from "@/app/auth/actions";

type Mode = "login" | "signup";

/**
 * Email + password auth form. Calls Stream C's real server actions
 * (`login` / `signup`) on submit. Displays the action's error message
 * inline; on success the server action redirects to /dashboard or /onboarding.
 */
export default function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = mode === "login"
        ? await login(email, password)
        : await signup(email, password);

      // Server actions that succeed call redirect() and never return here.
      // A returned { error } means the server action completed without redirect.
      if (result && "error" in result) {
        setError(result.error);
      }
    } catch (err) {
      // redirect() throws a special NEXT_REDIRECT error — that's expected on success
      // and Next.js handles it for us. Anything else is a real failure.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("NEXT_REDIRECT")) {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const cta = mode === "login" ? "Sign in" : "Create my account";

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

      <label className="block">
        <span className="veein-meta mb-2 block text-stone">Password</span>
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 6 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
          className="w-full border-b border-ink/30 bg-transparent pb-3 font-serif text-xl outline-none focus:border-blush transition-colors"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-medium text-canvas disabled:opacity-60"
      >
        {submitting ? "Working…" : cta}
        <span aria-hidden>→</span>
      </button>

      {error ? (
        <p className="text-sm text-blush" role="alert">{error}</p>
      ) : null}
    </form>
  );
}
