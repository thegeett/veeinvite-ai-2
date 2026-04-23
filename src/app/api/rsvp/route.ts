// STUB — Stream C Phase 6. Guest RSVP submission. PUBLIC — no auth required.
// Must validate events_attending IDs against couple's confirmed ceremonies.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Not implemented — Stream C Phase 6" },
    { status: 501 }
  );
}
