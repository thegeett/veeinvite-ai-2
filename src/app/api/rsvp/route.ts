// POST /api/rsvp — guest RSVP submission. PUBLIC endpoint (no auth).
//
// Plan §14 guest experience, §29 RSVP config, §16 VI-F008.
//
// Security posture:
//   - Uses admin client for INSERT because RLS policy allows public INSERT but
//     we still need to validate couple+ceremony relationships before inserting.
//   - `events_attending` IDs are validated against the couple's confirmed
//     ceremonies — unknown IDs are filtered out, not rejected (be lenient on
//     the read side; silence is safer than error leaks about ceremony names).
//   - Rejects if couple is unpublished, to avoid phantom submissions before the
//     couple has finalised their guest list.
//
// DECISIONS [2026-NN] (to be added): RSVPs use admin client for INSERT because
// RLS allows public INSERT but the shape validation must run server-side.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { rowToCouple } from "@/lib/db/mappers";

interface RsvpBody {
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  attending: boolean;
  guestCount?: number;
  childrenCount?: number;
  plusOneName?: string;
  eventsAttending?: string[];
  mealChoice?: string;
  dietary?: string;
  songRequest?: string;
  message?: string;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: Request) {
  let body: RsvpBody;
  try {
    body = (await request.json()) as RsvpBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.slug || !body.firstName || !body.lastName || !body.email) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }
  if (!isEmail(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (typeof body.attending !== "boolean") {
    return NextResponse.json({ error: "attending_must_be_boolean" }, { status: 400 });
  }

  const admin = createAdmin();
  const { data: coupleRow } = await admin
    .from("couples")
    .select("*")
    .eq("slug", body.slug)
    .single();
  if (!coupleRow) return NextResponse.json({ error: "couple_not_found" }, { status: 404 });

  const couple = rowToCouple(coupleRow);
  if (!couple.is_published) {
    return NextResponse.json({ error: "not_published" }, { status: 403 });
  }

  // Validate ceremony IDs against the couple's confirmed events.
  const { data: eventRows } = await admin
    .from("events")
    .select("id, event_type")
    .eq("couple_id", couple.id);
  const validEventIds = new Set((eventRows ?? []).map((r) => r.id));
  const validEventTypes = new Set((eventRows ?? []).map((r) => r.event_type).filter(Boolean));

  const attending = (body.eventsAttending ?? []).filter(
    (id) => validEventIds.has(id) || validEventTypes.has(id)
  );
  if ((body.eventsAttending ?? []).length > 0 && attending.length === 0) {
    return NextResponse.json({ error: "no_valid_ceremonies" }, { status: 400 });
  }

  const config = couple.rsvp_config;
  const guestCount = Math.min(
    Math.max(1, body.guestCount ?? 1),
    config?.guestCountMax ?? 10
  );
  const childrenCount = config?.childrenSeparate
    ? Math.min(Math.max(0, body.childrenCount ?? 0), config.childrenMax ?? 5)
    : 0;

  const { error } = await admin.from("rsvps").insert({
    couple_id: couple.id,
    first_name: body.firstName.slice(0, 100),
    last_name: body.lastName.slice(0, 100),
    email: body.email.slice(0, 200),
    attending: body.attending,
    guest_count: guestCount,
    children_count: childrenCount,
    plus_one_name: config?.plusOneEnabled ? (body.plusOneName ?? null) : null,
    events_attending: attending,
    meal_choice: config?.mealChoiceEnabled ? (body.mealChoice ?? null) : null,
    dietary: config?.dietaryEnabled ? (body.dietary ?? null) : null,
    song_request: config?.songRequestEnabled ? (body.songRequest ?? null) : null,
    message: config?.messageEnabled ? (body.message ?? null) : null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
