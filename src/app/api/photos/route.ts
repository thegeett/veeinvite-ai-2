// POST /api/photos — multipart photo upload, owner-only.
//
// Plan §16 VI-F017, DECISIONS [2026-01] (private bucket + markers).
//
// Returns storage paths (not URLs). Thumbnails in the dashboard go through
// GET /api/photos/[path]/sign to get a short-lived signed URL per request.
// Public site serving substitutes {{PHOTO:...}} markers at serve time.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireCoupleOwner } from "@/lib/db/auth";
import {
  uploadCouplePhoto,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_COUPLE,
  ALLOWED_PHOTO_MIMES
} from "@/lib/storage/photos";
import { reRenderAndUpload } from "@/lib/db/rerender";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });

  const coupleId = String(form.get("couple_id") ?? "");
  if (!coupleId) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });

  const gate = await requireCoupleOwner(coupleId);
  if (gate instanceof NextResponse) return gate;

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "no_files" }, { status: 400 });

  const existing = gate.couple.photo_urls ?? [];
  if (existing.length + files.length > MAX_PHOTOS_PER_COUPLE) {
    return NextResponse.json(
      { error: `too_many_photos`, max: MAX_PHOTOS_PER_COUPLE, have: existing.length },
      { status: 400 }
    );
  }

  const results: Array<{ path: string } | { error: string; file: string }> = [];
  const newPaths: string[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) {
      results.push({ error: `exceeds ${MAX_PHOTO_BYTES / 1024 / 1024}MB`, file: file.name });
      continue;
    }
    if (!ALLOWED_PHOTO_MIMES.includes(file.type as (typeof ALLOWED_PHOTO_MIMES)[number])) {
      results.push({ error: `unsupported mime ${file.type}`, file: file.name });
      continue;
    }
    const r = await uploadCouplePhoto(coupleId, file);
    if ("path" in r) {
      results.push({ path: r.path });
      newPaths.push(r.path);
    } else {
      results.push({ error: r.error, file: file.name });
    }
  }

  if (newPaths.length > 0) {
    const merged = [...existing, ...newPaths];
    const admin = createAdmin();
    await admin.from("couples").update({ photo_urls: merged }).eq("id", coupleId);
    try {
      await reRenderAndUpload(coupleId);
    } catch {
      // Site is not yet generated — photos still saved; next /api/generate picks them up.
    }
  }

  return NextResponse.json({ photo_paths: newPaths, results });
}
