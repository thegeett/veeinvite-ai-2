// Server actions for auth. Consumed from Stream A's /auth/login and /auth/signup
// pages — they import the functions and wire them to form submit handlers.

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMostRecentCoupleForUser } from "@/lib/db/auth";

export type AuthResult = { error: string } | { ok: true };

export async function signup(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`
    }
  });
  if (error) return { error: error.message };
  redirect("/onboarding");
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  // Wizard journey routing (plan §34.3): returning users go to /welcome,
  // new users go to /onboarding (Step 1).
  if (user) {
    const couple = await getMostRecentCoupleForUser(user.id);
    if (couple) redirect("/welcome");
  }
  redirect("/onboarding");
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
