// HTML storage helpers — upload rendered site HTML to private Supabase buckets.
// Both buckets (invitation-sites, preview-sites) are private; access always goes
// through the /w/[slug] and /preview/[token] route handlers (see DECISIONS [2026-01]).

import { createAdmin } from "@/lib/supabase/admin";

export const INVITATION_SITES_BUCKET = "invitation-sites";
export const PREVIEW_SITES_BUCKET = "preview-sites";

/**
 * Upload or overwrite the rendered site HTML for a couple.
 * Returns the storage path (not a public URL — bucket is private).
 */
export async function uploadSiteHtml(slug: string, html: string): Promise<string> {
  const path = `${slug}.html`;
  const supabase = createAdmin();
  const { error } = await supabase.storage
    .from(INVITATION_SITES_BUCKET)
    .upload(path, html, {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
  if (error) {
    throw new Error(`uploadSiteHtml(${slug}): ${error.message}`);
  }
  return path;
}

export async function readSiteHtml(slug: string): Promise<string | null> {
  const supabase = createAdmin();
  const { data, error } = await supabase.storage
    .from(INVITATION_SITES_BUCKET)
    .download(`${slug}.html`);
  if (error || !data) return null;
  return await data.text();
}

/** Upload preview HTML to the private preview-sites bucket. */
export async function uploadPreviewHtml(token: string, html: string): Promise<string> {
  const path = `${token}.html`;
  const supabase = createAdmin();
  const { error } = await supabase.storage
    .from(PREVIEW_SITES_BUCKET)
    .upload(path, html, {
      contentType: "text/html; charset=utf-8",
      upsert: true
    });
  if (error) {
    throw new Error(`uploadPreviewHtml(${token}): ${error.message}`);
  }
  return path;
}

export async function readPreviewHtml(token: string): Promise<string | null> {
  const supabase = createAdmin();
  const { data, error } = await supabase.storage
    .from(PREVIEW_SITES_BUCKET)
    .download(`${token}.html`);
  if (error || !data) return null;
  return await data.text();
}
