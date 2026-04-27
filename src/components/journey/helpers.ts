// Pure helpers for the wizard journey (plan §34.4). Kept in their own
// .ts file so they're importable from tests without the JSX in
// JourneyProgress.tsx tripping vitest's import analysis.

export type StepNumber = 1 | 2 | 3 | 4;

export type JourneyReachable = {
  /** Step 1 is always reachable (entry point); not in this map. */
  2: boolean;
  3: boolean;
  /** Step 4 is the future "Guests" step; today always false. */
  4: boolean;
};

/**
 * Step-number → route resolver. Step 1 always lands on `/onboarding`
 * (the dispatcher fetches the user's couple from the auth session, so URL
 * params aren't required). Steps 2 and 3 require a `couple_id` to deep-link
 * — without one they return null (caller renders the pill as locked).
 * Step 4 always returns null (Coming soon — no destination yet).
 */
export function hrefFor(
  step: StepNumber,
  coupleId: string | undefined,
  slug: string | undefined
): string | null {
  if (step === 1) return "/onboarding";
  if (step === 4) return null;
  if (!coupleId) return null;
  const params = new URLSearchParams({
    couple: coupleId,
    slug: slug ?? ""
  });
  if (step === 2) return `/onboarding/step-2?${params.toString()}`;
  if (step === 3) return `/dashboard?${params.toString()}`;
  return null;
}

/**
 * Compute reachability flags from the couple row. Step 2 unlocks once a
 * couple exists; Step 3 unlocks once `theme_json` is present (the AI
 * pipeline ran, plan §34.4); Step 4 is hard-coded to false until the
 * Guests surface ships.
 */
export function computeReachable(
  couple: { theme_json: unknown } | null
): JourneyReachable {
  return {
    2: couple !== null,
    3: couple !== null && couple.theme_json !== null,
    4: false
  };
}
