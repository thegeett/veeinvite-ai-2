// GET /api/versions?coupleId=<uuid> — list a couple's version history.
//
// Owner-only. Returns versions sorted newest first with the minimum surface
// the "Your designs" panel needs: id, version_number, label, instruction,
// design_summary, created_at.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const coupleId = searchParams.get("coupleId") ?? searchParams.get("couple_id");
  if (!coupleId) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });

  const admin = createAdmin();
  const { data: couple } = await admin
    .from("couples")
    .select("user_id")
    .eq("id", coupleId)
    .single();
  if (!couple) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (couple.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: rows, error } = await admin
    .from("site_versions")
    .select("*")
    .eq("couple_id", coupleId)
    .order("version_number", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(rows ?? []);
}
