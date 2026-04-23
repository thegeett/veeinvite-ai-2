import type { Config } from "tailwindcss";

// Tailwind is used for the dashboard/app UI only.
// Generated wedding sites (/w/[slug]) do NOT use Tailwind — they are self-contained
// HTML with inline styles built by the renderer from AI-generated CSS JSON.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: { extend: {} },
  plugins: []
};

export default config;
