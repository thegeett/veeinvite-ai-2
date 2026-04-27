// /welcome — post-login lobby for returning users (plan §34.3).
//
// New users (no couple row) are sent to /onboarding by the login action;
// they should never land here. Defensive: if a user somehow reaches /welcome
// without a couple, redirect them to /onboarding.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMostRecentCoupleForUser } from "@/lib/db/auth";
import { InvitationOverview } from "@/components/onboarding/InvitationOverview";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Middleware enforces auth on /welcome, so user should be set; defensive.
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent("/welcome")}`);
  }

  const couple = await getMostRecentCoupleForUser(user.id);
  if (!couple) {
    redirect("/onboarding");
  }

  return <InvitationOverview couple={couple} />;
}
