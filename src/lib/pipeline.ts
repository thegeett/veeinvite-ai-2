import fs from 'node:fs';
import path from 'node:path';
import type { CoupleData, WeddingEvent, ThemeJSON } from './types';
import { validateAll } from './validator';
import { buildSite } from './renderer';

let cachedSkeleton: string | null = null;

/**
 * Read the skeleton HTML from disk. Cached in-process after first read.
 */
export function readSkeleton(): string {
  if (cachedSkeleton !== null) return cachedSkeleton;
  const p = path.join(process.cwd(), 'skeleton', 'wedding-skeleton.html');
  cachedSkeleton = fs.readFileSync(p, 'utf-8');
  return cachedSkeleton;
}

/**
 * Render the final HTML from a theme_json + couple + events tuple.
 * Used by generate, edit, and structured routes.
 */
export function renderSiteFromTheme(
  themeJson: ThemeJSON,
  couple: CoupleData,
  events: WeddingEvent[],
): { html: string; validated: ReturnType<typeof validateAll> } {
  const validated = validateAll(themeJson);
  const skeleton = readSkeleton();
  const html = buildSite({
    skeleton,
    styles: validated.validStyles,
    fonts: validated.validFonts,
    particles: validated.validParticles,
    content: validated.validContent,
    couple,
    events,
  });
  return { html, validated };
}

/**
 * Upload generated HTML to Supabase Storage at `{coupleId}/site.html`.
 * Returns the public URL.
 */
export async function uploadSiteHtml(
  serviceClient: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          body: Blob | ArrayBuffer | string,
          opts: { contentType: string; upsert: boolean },
        ) => Promise<{ error: unknown }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  coupleId: string,
  html: string,
): Promise<string> {
  const bucket = 'wedding-sites';
  const filePath = `${coupleId}/site.html`;
  const blob = new Blob([html], { type: 'text/html' });

  const { error } = await serviceClient.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: 'text/html; charset=utf-8',
      upsert: true,
    });

  if (error) {
    const msg = (error as { message?: string }).message || 'unknown storage error';
    throw new Error(`Failed to upload HTML to Storage: ${msg}`);
  }

  // Storage caches aggressively — append a cache-buster timestamp so
  // the iframe re-fetches after regeneration.
  const { data } = serviceClient.storage.from(bucket).getPublicUrl(filePath);
  const base = data.publicUrl;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${Date.now()}`;
}
