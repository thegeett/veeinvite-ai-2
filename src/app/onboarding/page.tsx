// /onboarding — server dispatcher.
//
// Returning users (who already have a couple row) see the InvitationOverview
// with options to continue editing or start over. New users see the step-1
// form. Login redirects here, so this page is the user's "home" inside the
// authenticated app. See DECISIONS [2026-14].

import { createClient } from "@/lib/supabase/server";
import { getMostRecentCoupleForUser } from "@/lib/db/auth";
import { OnboardingStep1Form } from "@/components/onboarding/OnboardingStep1Form";
import { InvitationOverview } from "@/components/onboarding/InvitationOverview";

export const dynamic = "force-dynamic";

export default async function OnboardingEntryPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Middleware enforces auth on /onboarding, so user should be set; defensive
  // fall-through to the form if anything is off.
  if (user) {
    const couple = await getMostRecentCoupleForUser(user.id);
    if (couple) {
      return <InvitationOverview couple={couple} />;
    }
  }

  return <OnboardingStep1Form />;
}
