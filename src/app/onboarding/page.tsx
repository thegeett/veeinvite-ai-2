// /onboarding — Step 1 (Basics) of the wizard journey (plan §34).
//
// Server component. Fetches the user's most recent couple (if any) and hands
// it to OnboardingStep1Form along with reachability flags so the journey
// progress bar locks/unlocks the appropriate downstream steps. New users
// get an empty form; returning users get a prefilled one whose submit
// UPDATEs (not INSERTs).

import { createClient } from "@/lib/supabase/server";
import { getMostRecentCoupleForUser } from "@/lib/db/auth";
import { OnboardingStep1Form } from "@/components/onboarding/OnboardingStep1Form";
import { computeReachable } from "@/components/journey/JourneyProgress";

export const dynamic = "force-dynamic";

export default async function OnboardingStep1Page() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Middleware enforces auth on /onboarding, so user should be set; defensive.
  const couple = user ? await getMostRecentCoupleForUser(user.id) : null;
  const reachable = computeReachable(couple);

  return <OnboardingStep1Form couple={couple} reachable={reachable} />;
}
