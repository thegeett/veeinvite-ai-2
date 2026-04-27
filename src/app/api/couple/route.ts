// /api/couple — owner-only operations on a couple row.
//
// GET ?id=<uuid>     — fetch the couple. Used by the dashboard.
// DELETE ?id=<uuid>  — destroy the invitation entirely (the "Start over" flow
//   from /welcome and Step 1, plan §34.5). Cascade FKs handle
//   events/site_versions/rsvp_*; this handler also removes the rendered HTML
//   from the invitation-sites bucket and any photos under couple-photos/<id>/.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { rowToCouple } from "@/lib/db/mappers";
import { INVITATION_SITES_BUCKET } from "@/lib/storage/html";
import { COUPLE_PHOTOS_BUCKET } from "@/lib/storage/photos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const admin = createAdmin();
  const { data: row, error } = await admin
    .from("couples")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(rowToCouple(row));
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const admin = createAdmin();
  const { data: row } = await admin
    .from("couples")
    .select("id, slug, user_id")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Best-effort storage cleanup — failures here don't block the row delete
  // (the data is the authoritative state; orphaned files can be GC'd later).
  await admin.storage.from(INVITATION_SITES_BUCKET).remove([`${row.slug}.html`]);

  const { data: photoFiles } = await admin.storage
    .from(COUPLE_PHOTOS_BUCKET)
    .list(row.id);
  if (photoFiles && photoFiles.length > 0) {
    await admin.storage
      .from(COUPLE_PHOTOS_BUCKET)
      .remove(photoFiles.map((f) => `${row.id}/${f.name}`));
  }

  // FK cascades handle events / site_versions / rsvp_* / preview_tokens.
  const { error: delErr } = await admin.from("couples").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
