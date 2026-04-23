// STUB — Stream C Phase 6 (M2 feature, 501 in M1). See plan §13.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Not implemented — M2 feature" },
    { status: 501 }
  );
}
