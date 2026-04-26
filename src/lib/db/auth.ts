// Small helpers used by API route handlers.
// `requireUser` returns either the authenticated user id or a NextResponse to
// return immediately. Middleware already blocks unauthenticated requests on
// protected prefixes, but route handlers call this as a defence-in-depth check.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { rowToCouple } from "@/lib/db/mappers";
import type { CoupleData } from "@/lib/types";

export async function requireUser(): Promise<{ userId: string } | NextResponse> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return { userId: user.id };
}

/**
 * Ensure the authenticated user owns the given couple. Returns the couple on
 * success, or a NextResponse 403/404 on failure.
 */
export async function requireCoupleOwner(
  coupleId: string
): Promise<{ couple: CoupleData } | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdmin();
  const { data: row } = await supabase
    .from("couples")
    .select("*")
    .eq("id", coupleId)
    .single();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const couple = rowToCouple(row);
  if (couple.user_id !== auth.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return { couple };
}

/**
 * The authenticated user's most recent couple, or null. Used by login and
 * dashboard server-side routing to land returning users on their existing
 * invitation rather than a fresh onboarding form.
 */
export async function getMostRecentCoupleForUser(
  userId: string
): Promise<CoupleData | null> {
  const supabase = createAdmin();
  const { data: row } = await supabase
    .from("couples")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return row ? rowToCouple(row) : null;
}
