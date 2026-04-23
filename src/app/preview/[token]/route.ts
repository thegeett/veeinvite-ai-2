// GET /preview/[token] — shareable preview (§32 Hook 3).
//
// Same signed-URL substitution flow as /w/[slug], with a token-validation step
// at the front. Cache-Control is `private` — preview links are per-recipient
// and must not be cached by shared proxies.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { readPreviewHtml } from "@/lib/storage/html";
import { substitutePhotoMarkers } from "@/lib/storage/photos";

export const dynamic = "force-dynamic";

function expiredPage(): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8"/>
  <title>Preview expired</title>
  <style>body{font-family:system-ui;padding:4rem;text-align:center;background:#0E0A0F;color:#FDF6EE;margin:0;min-height:100vh}</style>
</head><body>
  <h1>This preview has expired</h1>
  <p>Ask the couple for a fresh link, or <a style="color:#E8A0B0" href="/">create your own →</a></p>
</body></html>`,
    {
      status: 410,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token) return new NextResponse("Not found", { status: 404 });

  const admin = createAdmin();
  const { data: row } = await admin
    .from("preview_tokens")
    .select("token, couple_id, expires_at")
    .eq("token", token)
    .single();

  if (!row) return new NextResponse("Not found", { status: 404 });
  if (new Date(row.expires_at).getTime() < Date.now()) return expiredPage();

  const rawHtml = await readPreviewHtml(token);
  if (!rawHtml) return new NextResponse("Preview not available", { status: 404 });

  const html = await substitutePhotoMarkers(rawHtml, 3600);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Private — preview links are per-recipient; do not let shared caches store.
      "cache-control": "private, max-age=300"
    }
  });
}
