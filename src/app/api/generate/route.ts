// STUB — Stream C Phase 6 replaces with the full generation flow.
// POST /api/generate — takes quiz answers → runs pipeline.generateSite → persists → returns site URL.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Not implemented — Stream C Phase 6" },
    { status: 501 }
  );
}
