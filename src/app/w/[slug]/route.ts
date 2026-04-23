// GET /w/[slug] — public wedding site.
//
// Plan architecture rule 11 — raw HTML, never wrapped in Next.js layout.
// Plan §4, DECISIONS [2026-01] — signed-URL substitution at serve time.
//
// Flow:
//   1. Look up couple by slug via admin client (RLS would block anonymous reads).
//   2. If unpublished → "coming soon" HTML.
//   3. Fetch HTML from private `invitation-sites` bucket.
//   4. Substitute every `{{PHOTO:path}}` marker with a 1-hour signed URL.
//   5. Return with Cache-Control: public, max-age=600.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { readSiteHtml } from "@/lib/storage/html";
import { substitutePhotoMarkers } from "@/lib/storage/photos";

export const dynamic = "force-dynamic";

function comingSoon(slug: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Coming soon — ${slug}</title>
  <style>
    body{font-family:"Cormorant Garamond",Georgia,serif;background:#0E0A0F;color:#FDF6EE;
         display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem}
    h1{font-size:clamp(2rem,6vw,3rem);font-weight:400;margin:0 0 .5rem;letter-spacing:.02em}
    p{opacity:.6;margin:0}
  </style>
</head><body>
  <div><h1>Coming soon</h1><p>This wedding site has not been published yet.</p></div>
</body></html>`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60"
      }
    }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  const admin = createAdmin();
  const { data: couple } = await admin
    .from("couples")
    .select("id, slug, is_published")
    .eq("slug", slug)
    .single();

  if (!couple) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "content-type": "text/plain" }
    });
  }

  if (!couple.is_published) {
    return comingSoon(slug);
  }

  const rawHtml = await readSiteHtml(slug);
  if (!rawHtml) {
    return comingSoon(slug);
  }

  const html = await substitutePhotoMarkers(rawHtml, 3600);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=600"
    }
  });
}
