import type { Config } from "tailwindcss";

// Tailwind is used for the dashboard/app UI only.
// Generated wedding sites (/w/[slug]) do NOT use Tailwind — they are self-contained
// HTML with inline styles built by the renderer from AI-generated CSS JSON.
const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F4EFE6",
        paper: "#FAF6EE",
        ink: "#1D1A1A",
        blush: "#C7524C",
        gold: "#B89965",
        stone: "#817973",
        line: "#D9CFC0"
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      letterSpacing: {
        meta: "0.22em"
      },
      animation: {
        "veein-rise": "veein-rise 0.9s cubic-bezier(.2,.7,.2,1) both"
      },
      keyframes: {
        "veein-rise": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
