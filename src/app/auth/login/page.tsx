import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "Sign in — VeeInvite"
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto grid min-h-screen max-w-[1200px] gap-0 px-6 py-10 md:grid-cols-2 md:gap-16 md:px-10">
        <section className="flex flex-col justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <div>
            <div className="veein-meta mb-4">§ Welcome back</div>
            <h1 className="font-serif text-5xl leading-[1.05] md:text-7xl">
              Your wedding, <span className="italic text-blush">picking up where you left off.</span>
            </h1>
            <p className="mt-6 max-w-md text-ink/70">
              We remember every design you liked, every edit you made. Sign in to keep going.
            </p>
          </div>
          <div className="veein-meta text-stone">
            Issue No. 01 · For two
          </div>
        </section>

        <section className="flex flex-col justify-center">
          <AuthForm mode="login" />
          <p className="mt-6 text-sm text-ink/70">
            New here?{" "}
            <Link href="/auth/signup" className="text-ink underline">
              Create an account
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
