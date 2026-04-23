// Photo storage helpers.
//
// The `couple-photos` bucket is PRIVATE (DECISIONS [2026-01]). Uploads are gated
// by /api/photos (owner-only) and reads happen only through signed URLs
// generated at serve time by /w/[slug] and /preview/[token].

import { createAdmin } from "@/lib/supabase/admin";

export const COUPLE_PHOTOS_BUCKET = "couple-photos";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per image
export const MAX_PHOTOS_PER_COUPLE = 20;
export const ALLOWED_PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export type UploadResult = { path: string } | { error: string };

export async function uploadCouplePhoto(
  coupleId: string,
  file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }
): Promise<UploadResult> {
  if (file.size > MAX_PHOTO_BYTES) {
    return { error: `file exceeds ${MAX_PHOTO_BYTES / 1024 / 1024}MB` };
  }
  if (!ALLOWED_PHOTO_MIMES.includes(file.type as (typeof ALLOWED_PHOTO_MIMES)[number])) {
    return { error: `unsupported mime type: ${file.type}` };
  }
  const ext = EXT_BY_MIME[file.type];
  const id = crypto.randomUUID();
  const path = `${coupleId}/${id}.${ext}`;

  const buffer = await file.arrayBuffer();
  const supabase = createAdmin();
  const { error } = await supabase.storage
    .from(COUPLE_PHOTOS_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false
    });
  if (error) return { error: error.message };
  return { path };
}

/**
 * Generate signed URLs for many photo paths in a single round-trip.
 * The returned map is keyed by input path. Missing paths are omitted.
 *
 * @param expiresInSeconds default 3600 (1 hour) — keep short; HTML is cached for 10 min,
 *   so we re-sign before expiry on the next uncached request.
 */
export async function signPhotoUrls(
  paths: string[],
  expiresInSeconds = 3600
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths));
  if (unique.length === 0) return {};

  const supabase = createAdmin();
  const { data, error } = await supabase.storage
    .from(COUPLE_PHOTOS_BUCKET)
    .createSignedUrls(unique, expiresInSeconds);
  if (error || !data) return {};

  const map: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) {
      map[item.path] = item.signedUrl;
    }
  }
  return map;
}

export async function deleteCouplePhoto(path: string): Promise<boolean> {
  const supabase = createAdmin();
  const { error } = await supabase.storage.from(COUPLE_PHOTOS_BUCKET).remove([path]);
  return !error;
}

/**
 * Walk `{{PHOTO:path}}` markers in HTML and substitute with freshly-signed URLs.
 * Unknown / missing paths are replaced with an empty `src=""` so the page still
 * renders. Used by /w/[slug] and /preview/[token].
 */
export async function substitutePhotoMarkers(html: string, expiresInSeconds = 3600): Promise<string> {
  const markerRe = /\{\{PHOTO:([^}]+)\}\}/g;
  const paths = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(html)) !== null) {
    paths.add(m[1].trim());
  }
  if (paths.size === 0) return html;

  const signed = await signPhotoUrls(Array.from(paths), expiresInSeconds);
  return html.replace(markerRe, (_match, rawPath: string) => {
    const path = rawPath.trim();
    return signed[path] ?? "";
  });
}
