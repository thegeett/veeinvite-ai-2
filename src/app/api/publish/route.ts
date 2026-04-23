// POST /api/publish — flip is_published to true (M1 is free; M2 adds Stripe).
//
// Plan §15, architecture rule 10 (server-only).

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireCoupleOwner } from "@/lib/db/auth";

interface PublishBody {
  couple_id: string;
}

export async function POST(request: Request) {
  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.couple_id) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });

  const gate = await requireCoupleOwner(body.couple_id);
  if (gate instanceof NextResponse) return gate;

  const admin = createAdmin();
  const { error } = await admin
    .from("couples")
    .update({ is_published: true })
    .eq("id", body.couple_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    published: true,
    site_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/w/${gate.couple.slug}`
  });
}
