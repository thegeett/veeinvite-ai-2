// GET /api/photos/sign?path=coupleId/uuid.ext — short-lived signed URL for
// a single photo. Owner-only.
//
// Used by the dashboard to display thumbnails. The public site substitutes
// markers itself — this is only for the authenticated dashboard preview.

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/db/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { signPhotoUrls } from "@/lib/storage/photos";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const path = request.nextUrl.searchParams.get("path")?.trim() ?? "";
  if (!path || !path.includes("/")) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }

  const coupleId = path.split("/")[0];
  const admin = createAdmin();
  const { data: couple } = await admin
    .from("couples")
    .select("id, user_id")
    .eq("id", coupleId)
    .single();
  if (!couple) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (couple.user_id !== auth.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const signed = await signPhotoUrls([path], 600);
  const url = signed[path];
  if (!url) return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  return NextResponse.json({ url });
}
