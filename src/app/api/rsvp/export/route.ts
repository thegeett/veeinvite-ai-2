// POST /api/rsvp/export — CSV export of a couple's RSVPs. Owner-only.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireCoupleOwner } from "@/lib/db/auth";
import { rowToRsvp } from "@/lib/db/mappers";

interface ExportBody {
  couple_id: string;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function POST(request: Request) {
  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.couple_id) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });

  const gate = await requireCoupleOwner(body.couple_id);
  if (gate instanceof NextResponse) return gate;

  const admin = createAdmin();
  const { data: rows } = await admin
    .from("rsvps")
    .select("*")
    .eq("couple_id", body.couple_id)
    .order("created_at", { ascending: true });

  const rsvps = (rows ?? []).map(rowToRsvp);
  const headers = [
    "first_name", "last_name", "email", "attending",
    "guest_count", "children_count", "plus_one_name",
    "events_attending", "meal_choice", "dietary",
    "song_request", "message", "created_at"
  ];
  const lines = [
    headers.join(","),
    ...rsvps.map((r) => [
      r.first_name, r.last_name, r.email, r.attending,
      r.guest_count, r.children_count, r.plus_one_name,
      r.events_attending.join(";"), r.meal_choice, r.dietary,
      r.song_request, r.message, r.created_at
    ].map(csvEscape).join(","))
  ];
  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rsvps-${gate.couple.slug}.csv"`
    }
  });
}
