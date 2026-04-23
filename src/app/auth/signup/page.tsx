import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "Sign up — VeeInvite"
};

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto grid min-h-screen max-w-[1200px] gap-0 px-6 py-10 md:grid-cols-2 md:gap-16 md:px-10">
        <section className="flex flex-col justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <div>
            <div className="veein-meta mb-4">§ Start yours</div>
            <h1 className="font-serif text-5xl leading-[1.05] md:text-7xl">
              A wedding website <span className="italic text-blush">in the time it takes to make tea.</span>
            </h1>
            <p className="mt-6 max-w-md text-ink/70">
              Free to create and edit. Pay £29 only if you decide to publish. No credit card to start.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-ink/70">
              <li>· Four layouts, twenty cultures</li>
              <li>· Plain-English edits</li>
              <li>· RSVP dashboard with CSV export</li>
            </ul>
          </div>
          <div className="veein-meta text-stone">Issue No. 01 · For two</div>
        </section>

        <section className="flex flex-col justify-center">
          <AuthForm mode="signup" />
          <p className="mt-6 text-sm text-ink/70">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-ink underline">
              Sign in
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
