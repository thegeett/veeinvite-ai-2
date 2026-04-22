import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-ink text-cream">
      <nav className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-serif text-xl tracking-wider">VeeInvite</span>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/auth/login"
            className="text-cream/70 hover:text-cream"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-full bg-cream text-ink px-4 py-2 text-xs font-medium hover:bg-white"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="px-6 py-24 md:py-32 text-center">
        <p className="text-[11px] uppercase tracking-[0.4em] text-cream/50">
          AI-designed wedding websites
        </p>
        <h1 className="mt-6 font-serif text-5xl md:text-7xl leading-tight max-w-4xl mx-auto">
          Your wedding website,<br />
          <span className="italic opacity-80">designed by AI.</span>
        </h1>
        <p className="mt-6 text-cream/70 text-base md:text-lg max-w-xl mx-auto">
          Answer six questions. Get a beautiful, personalised wedding
          website in minutes — with a live RSVP form and a dashboard to
          manage it all.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-cream text-ink px-6 py-3 text-sm font-medium hover:bg-white"
          >
            Create yours free
          </Link>
          <a
            href="#how"
            className="rounded-full border border-cream/30 px-6 py-3 text-sm text-cream/80 hover:bg-cream/5"
          >
            See how it works
          </a>
        </div>
      </section>

      <section id="how" className="px-6 py-20 md:py-24 border-t border-cream/10">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.4em] text-cream/50 text-center">
            How it works
          </p>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl text-center">
            Three steps, start to invitation.
          </h2>
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Step
              n="One"
              title="Tell us about your wedding"
              body="Answer a few short questions — names, date, venue, style, story, vibe. Nothing else."
            />
            <Step
              n="Two"
              title="AI designs your site"
              body="Our designer reads your story and creates a unique visual identity — typography, colours, copy, and animation."
            />
            <Step
              n="Three"
              title="Share with your guests"
              body="Send the link. Guests RSVP directly on your site. You see responses and edit anything from the dashboard."
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:py-24 border-t border-cream/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl">
            Edit anything, anytime.
          </h2>
          <p className="mt-5 text-cream/70">
            Change names and dates instantly. Chat with the AI designer for a
            different mood — warmer, more romantic, more bohemian. The RSVP
            form is always there, always working.
          </p>
          <div className="mt-10">
            <Link
              href="/auth/signup"
              className="rounded-full bg-cream text-ink px-6 py-3 text-sm font-medium hover:bg-white"
            >
              Start building →
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-cream/10 flex items-center justify-between text-xs text-cream/50">
        <span>© {new Date().getFullYear()} VeeInvite</span>
        <Link href="/auth/login" className="hover:text-cream">
          Sign in
        </Link>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-cream/10 p-6">
      <div className="font-serif italic text-cream/50 text-sm">{n}</div>
      <h3 className="mt-3 font-serif text-xl">{title}</h3>
      <p className="mt-3 text-sm text-cream/70 leading-relaxed">{body}</p>
    </div>
  );
}
