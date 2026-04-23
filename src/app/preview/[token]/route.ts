// STUB — Stream C Phase 6. Shareable preview link (§32 Hook 3).
// Same as /w/[slug] but RSVP replaced by "Create yours" CTA and 7-day expiry.

import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  return new NextResponse(
    `<!DOCTYPE html>
<html><head><title>VeeInvite Preview</title></head>
<body style="font-family:system-ui;text-align:center;padding:4rem">
  <h1>Preview coming soon</h1>
  <p>Token: ${params.token}</p>
</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
