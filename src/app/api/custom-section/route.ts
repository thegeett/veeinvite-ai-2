// POST /api/custom-section — M2 feature. 501 in M1.
// Plan §13.

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "not_implemented_m1" }, { status: 501 });
}
