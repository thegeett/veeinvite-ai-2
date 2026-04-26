// /onboarding/step-2 — server-fetched, owner-checked, prefilled.
//
// Step 2 used to read everything from URL params — back-button navigation
// from the dashboard would land users on an empty form and discard their
// previous selections. Now we look the couple up server-side by `?couple=`,
// verify ownership, and hand the row to OnboardingStep2Form so the React
// state initialises from the DB (style / vibe / story / cultures all
// round-trip). See DECISIONS [2026-14].

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { rowToCouple } from "@/lib/db/mappers";
import { OnboardingStep2Form } from "@/components/onboarding/OnboardingStep2Form";

export const dynamic = "force-dynamic";

export default async function OnboardingStep2Page({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const coupleId = typeof searchParams.couple === "string" ? searchParams.couple : null;
  if (!coupleId) redirect("/onboarding");

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent("/onboarding")}`);
  }

  const admin = createAdmin();
  const { data: row } = await admin
    .from("couples")
    .select("*")
    .eq("id", coupleId)
    .single();

  // No row, or owned by someone else, or stale link from a deleted couple —
  // bounce back to the entry which will dispatch correctly.
  if (!row || row.user_id !== user.id) {
    redirect("/onboarding");
  }

  return <OnboardingStep2Form couple={rowToCouple(row)} />;
}
