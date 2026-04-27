// /onboarding/step-2 — Step 2 (Brief) of the wizard journey (plan §34).
//
// Server component. Fetches the couple by ?couple= and verifies ownership,
// then hands the row to OnboardingStep2Form so React state initialises from
// the DB. Stale links and missing IDs bounce back to /onboarding which
// dispatches correctly.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { rowToCouple } from "@/lib/db/mappers";
import { OnboardingStep2Form } from "@/components/onboarding/OnboardingStep2Form";
import { computeReachable } from "@/components/journey/JourneyProgress";

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

  if (!row || row.user_id !== user.id) {
    redirect("/onboarding");
  }

  const couple = rowToCouple(row);
  const reachable = computeReachable(couple);
  return <OnboardingStep2Form couple={couple} reachable={reachable} />;
}
