// STUB — Stream C Phase 12 replaces.
// Public wedding site. Returns raw HTML (architecture rule 11) — NOT wrapped
// in Next.js layout. Reads from Supabase Storage or rebuilds on the fly.

import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>Coming Soon — ${params.slug}</title></head>
<body style="font-family:system-ui;text-align:center;padding:4rem">
  <h1>Coming soon</h1>
  <p>This wedding site has not been published yet.</p>
</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
