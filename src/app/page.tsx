import Link from "next/link";
import { LayoutMini } from "@/components/landing/LayoutMini";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";

const LAYOUTS = [
  {
    id: "layout-1",
    flavor: "modern" as const,
    name: "Modern Minimalist",
    tagline: "Airy. Disciplined. Lets the names breathe."
  },
  {
    id: "layout-2",
    flavor: "romantic" as const,
    name: "Romantic Traditional",
    tagline: "Warm, layered, a little decorative. Like a love letter."
  },
  {
    id: "layout-3",
    flavor: "grand" as const,
    name: "Grand Celebration",
    tagline: "Built for six ceremonies and three-generation family trees."
  },
  {
    id: "layout-4",
    flavor: "editorial" as const,
    name: "Editorial Bold",
    tagline: "Asymmetric. Confident. Magazine-cover composure."
  }
];

const CULTURES: { label: string; emph: "lg" | "md" | "sm" }[] = [
  { label: "Western",              emph: "md" },
  { label: "Hindu · Punjabi",      emph: "lg" },
  { label: "Hindu · Tamil",        emph: "md" },
  { label: "Hindu · Gujarati",     emph: "sm" },
  { label: "Hindu · Bengali",      emph: "md" },
  { label: "Hindu · Marathi",      emph: "sm" },
  { label: "Hindu · Telugu",       emph: "sm" },
  { label: "Hindu · Kannada",      emph: "sm" },
  { label: "Hindu · Malayali",     emph: "sm" },
  { label: "Hindu · Marwari",      emph: "sm" },
  { label: "Jain",                 emph: "sm" },
  { label: "Sikh",                 emph: "md" },
  { label: "Muslim · South Asian", emph: "lg" },
  { label: "Muslim · Arab",        emph: "md" },
  { label: "Muslim · West African",emph: "sm" },
  { label: "Chinese",              emph: "md" },
  { label: "Jewish",               emph: "lg" },
  { label: "Yoruba",               emph: "md" },
  { label: "Igbo",                 emph: "sm" },
  { label: "Latin · Catholic",     emph: "md" }
];

const emphClass = {
  sm: "text-2xl md:text-3xl",
  md: "text-3xl md:text-5xl",
  lg: "text-5xl md:text-7xl"
};

// Hero headline split into words so each can animate in with its own delay.
const HEADLINE: Array<{ word: string; italic?: boolean }> = [
  { word: "A" },
  { word: "wedding" },
  { word: "website" },
  { word: "you’ll" },
  { word: "be" },
  { word: "proud" },
  { word: "to" },
  { word: "send", italic: true },
  { word: "—" },
  { word: "in" },
  { word: "two" },
  { word: "minutes." }
];

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const isAuthed = !!user;

  return (
    <main className="relative min-h-screen bg-canvas text-ink font-sans">
      {/* ================================================== */}
      {/*  MASTHEAD                                           */}
      {/* ================================================== */}
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-10">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="font-serif text-xl italic leading-none">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#layouts" className="veein-meta hover:text-ink transition-colors">
              The four
            </a>
            <a href="#cultures" className="veein-meta hover:text-ink transition-colors">
              Cultures
            </a>
            <a href="#how" className="veein-meta hover:text-ink transition-colors">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthed ? (
              <>
                <SignOutButton className="veein-meta hidden md:inline-block hover:text-ink transition-colors" />
                <Link
                  href="/dashboard"
                  className="inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-transform hover:-translate-y-0.5"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="veein-meta hidden md:inline-block hover:text-ink transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-transform hover:-translate-y-0.5"
                >
                  Start yours
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/*  HERO                                               */}
      {/* ================================================== */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1400px] px-6 pt-16 pb-24 md:px-10 md:pt-28 md:pb-36">
          <div className="grid gap-12 md:grid-cols-[1fr_auto] md:gap-20 items-end">
            <div>
              <div className="veein-meta mb-6 flex items-center gap-3">
                <span className="inline-block h-px w-10 bg-stone" />
                Volume 01 — An invitation, reimagined
              </div>
              <h1 className="font-serif font-normal leading-[0.98] tracking-[-0.02em] text-[clamp(2.75rem,8vw,8rem)]">
                {HEADLINE.map((w, i) => (
                  <span
                    key={i}
                    className="word-rise"
                    style={{
                      animationDelay: `${0.15 + i * 0.065}s`,
                      marginRight: w.word === "—" ? "0.3em" : "0.25em",
                      fontStyle: w.italic ? "italic" : "normal",
                      color: w.italic ? "#C7524C" : "inherit"
                    }}
                  >
                    {w.word}
                  </span>
                ))}
              </h1>
              <p className="mt-10 max-w-xl text-lg leading-relaxed text-ink/75">
                Answer four questions. Watch a real website appear — real copy, real structure,
                real cultural accuracy. Then edit in plain English until it feels like you.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href={isAuthed ? "/dashboard" : "/auth/signup"}
                  className="group relative inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-base font-medium text-canvas"
                >
                  {isAuthed ? "Continue to your dashboard" : "Start yours — it’s free"}
                  <span
                    aria-hidden
                    className="inline-block translate-x-0 transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
                <Link
                  href="#layouts"
                  className="inline-flex items-center gap-2 border-b border-ink/30 pb-0.5 text-base text-ink hover:border-ink"
                >
                  See an example
                </Link>
              </div>
            </div>

            {/* Editorial corner card — "Issue plate" */}
            <aside
              className="hidden md:block max-w-[280px] bg-paper border border-line p-6 -rotate-1 relative"
              style={{ boxShadow: "0 40px 60px -30px rgba(29,26,26,0.25)" }}
            >
              <div className="veein-meta mb-4">Issue No. 01</div>
              <p className="font-serif text-xl leading-snug">
                Built by a couple who have planned their own wedding. We wrote every line so
                you don’t have to.
              </p>
              <div className="mt-5 pt-4 border-t border-line veein-meta">
                2 min read · The promise
              </div>
            </aside>
          </div>
        </div>

        {/* Decorative gold hairline with monogram dot — newspaper folio */}
        <div className="relative">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 md:px-10">
            <div className="h-px flex-1 bg-line" />
            <span className="veein-meta text-gold">· Vee ·</span>
            <div className="h-px flex-1 bg-line" />
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/*  VALUE PROPS — 3 columns                            */}
      {/* ================================================== */}
      <section className="border-t border-line" id="how">
        <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-10 md:py-28 grid gap-12 md:grid-cols-3">
          {[
            {
              num: "01",
              title: "Coherence, not AI slop",
              body:
                "Your whole site is designed as one visual system in a single pass. No four-designers-with-different-taste mosaic."
            },
            {
              num: "02",
              title: "Cultural accuracy by design",
              body:
                "Tamil weddings don’t have a Baraat. Muslim sites don’t pour alcohol. Jewish sites surface the Chuppah. We encoded all of that."
            },
            {
              num: "03",
              title: "Plain-English edits",
              body:
                "Type “make the hero more dramatic” or “soften the colours.” Named fields for dates, venues, parents — AI for everything else."
            }
          ].map((item) => (
            <article key={item.num} className="flex flex-col gap-4">
              <span className="font-serif text-6xl leading-none text-blush">{item.num}</span>
              <h3 className="font-serif text-2xl leading-tight">{item.title}</h3>
              <p className="text-ink/70 leading-relaxed">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ================================================== */}
      {/*  LAYOUTS SHOWCASE                                   */}
      {/* ================================================== */}
      <section
        id="layouts"
        className="border-t border-line bg-paper/50"
      >
        <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-36">
          <div className="mb-16 flex items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="veein-meta mb-4">§ Four skeletons · one identity per couple</div>
              <h2 className="font-serif text-5xl leading-[1.02] md:text-6xl">
                Pick a frame. <span className="italic text-blush">Your design</span> goes inside it.
              </h2>
              <p className="mt-6 max-w-xl text-ink/70 leading-relaxed">
                Four structural templates for four different kinds of wedding. Culture and tone
                are an independent layer — applied on top.
              </p>
            </div>
            <div className="hidden md:block veein-meta text-right">
              <div>01 / 04</div>
              <div>Modern →</div>
            </div>
          </div>

          <div className="grid gap-x-10 gap-y-20 md:grid-cols-2">
            {LAYOUTS.map((l, i) => (
              <article
                key={l.id}
                className={`group ${i % 2 === 1 ? "md:mt-16" : ""}`}
              >
                <div className="relative transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:rotate-[-0.6deg]">
                  <LayoutMini flavor={l.flavor} />
                  {/* Hover overlay */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="veein-meta text-canvas bg-ink/85 px-2 py-1 rounded-sm">
                      See example →
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex items-baseline justify-between gap-4">
                  <h3 className="font-serif text-3xl leading-none">
                    {l.name}
                  </h3>
                  <span className="veein-meta">0{i + 1} / 04</span>
                </div>
                <p className="mt-3 text-ink/70">{l.tagline}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/*  CULTURES — typographic cloud                       */}
      {/* ================================================== */}
      <section id="cultures" className="border-t border-line">
        <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-10 md:py-36">
          <div className="max-w-2xl">
            <div className="veein-meta mb-4">§ 20+ cultural profiles · not bolted on</div>
            <h2 className="font-serif text-5xl leading-[1.02] md:text-6xl">
              Every ceremony. <span className="italic">The right name.</span>
            </h2>
            <p className="mt-6 max-w-xl text-ink/70 leading-relaxed">
              We maintain a living library of cultural detail — ceremony names, opening
              invocations, dress-code etiquette, RSVP norms. Sub-regions included. Interfaith
              conflicts surfaced, never silently resolved.
            </p>
          </div>

          <div className="mt-16 flex flex-wrap items-baseline gap-x-8 gap-y-4 leading-[1.05]">
            {CULTURES.map((c, i) => (
              <span
                key={c.label}
                className={`font-serif ${emphClass[c.emph]}`}
                style={{
                  color: i % 5 === 2 ? "#C7524C" : i % 5 === 4 ? "#B89965" : "#1D1A1A",
                  fontStyle: i % 3 === 0 ? "italic" : "normal",
                  opacity: c.emph === "sm" ? 0.7 : 1
                }}
              >
                {c.label}
                {i < CULTURES.length - 1 && (
                  <span className="text-stone/40 ml-2 text-base">·</span>
                )}
              </span>
            ))}
          </div>

          <div className="mt-16 grid gap-10 md:grid-cols-3 text-sm">
            <div>
              <div className="veein-meta mb-3">Per culture, we encode</div>
              <ul className="space-y-1.5 text-ink/75">
                <li>· Pre-selected ceremonies</li>
                <li>· Sub-region overrides</li>
                <li>· Content fields (parents, muhurat, ketubah)</li>
                <li>· Copy guardrails — what AI must never write</li>
              </ul>
            </div>
            <div>
              <div className="veein-meta mb-3">Per sub-region, we know</div>
              <ul className="space-y-1.5 text-ink/75">
                <li>· Tamil: Nischayathartham, Oonjal, Saptapadi</li>
                <li>· Punjabi: Roka, Chooda, Anand Karaj</li>
                <li>· Gujarati: Pithi, Mandap Muhurat, Vidaai</li>
                <li>· And ten more traditions besides</li>
              </ul>
            </div>
            <div>
              <div className="veein-meta mb-3">Interfaith, handled</div>
              <ul className="space-y-1.5 text-ink/75">
                <li>· Select multiple cultures</li>
                <li>· Merged ceremony list</li>
                <li>· Conflicts surfaced, not silent-resolved</li>
                <li>· You decide what to keep</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/*  FINAL CTA                                          */}
      {/* ================================================== */}
      <section className="border-t border-line bg-ink text-canvas">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10 md:py-40 text-center">
          <div className="veein-meta mb-6 text-gold">§ The only CTA you need</div>
          <h2 className="font-serif text-5xl leading-[1.02] md:text-8xl max-w-4xl mx-auto">
            Your site, <span className="italic text-blush">live in the next song</span> you play.
          </h2>
          <p className="mt-10 max-w-xl mx-auto text-canvas/70 leading-relaxed">
            Four quiz questions, one generated site, unlimited plain-English edits. Free to
            create. Pay only when you publish.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link
              href={isAuthed ? "/dashboard" : "/auth/signup"}
              className="inline-flex items-center gap-3 rounded-full bg-canvas px-8 py-4 text-base font-medium text-ink"
            >
              {isAuthed ? "Continue to your dashboard" : "Start yours — it’s free"}
              <span aria-hidden>→</span>
            </Link>
            {!isAuthed ? (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 border-b border-canvas/40 pb-0.5 text-canvas/90 hover:border-canvas"
              >
                I already have an account
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/*  FOOTER                                             */}
      {/* ================================================== */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-10 md:px-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg italic">Vee</span>
            <span className="veein-meta">INVITE · EST. 2026</span>
          </div>
          <div className="flex flex-wrap gap-6 veein-meta">
            {isAuthed ? (
              <>
                <Link href="/dashboard" className="hover:text-ink transition-colors">Dashboard</Link>
                <SignOutButton className="hover:text-ink transition-colors" />
              </>
            ) : (
              <>
                <Link href="/auth/signup" className="hover:text-ink transition-colors">Sign up</Link>
                <Link href="/auth/login" className="hover:text-ink transition-colors">Sign in</Link>
              </>
            )}
            <a href="#layouts" className="hover:text-ink transition-colors">Layouts</a>
            <a href="#cultures" className="hover:text-ink transition-colors">Cultures</a>
          </div>
          <div className="veein-meta text-stone">
            Made with love, for the people we love.
          </div>
        </div>
      </footer>
    </main>
  );
}
