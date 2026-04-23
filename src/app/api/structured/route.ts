// POST /api/structured — direct data edits, no AI call.
//
// Plan §12 (data classifier type), §30 "all edits update Supabase and HTML together".
//
// Accepts partial updates to `couples` (names, date, venue, rsvp_config) and to
// `events` (full replace). Re-renders and overwrites the HTML in storage.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireCoupleOwner } from "@/lib/db/auth";
import { reRenderAndUpload } from "@/lib/db/rerender";
import type { EventData, RSVPConfig } from "@/lib/types";

type StructuredPatch = {
  couple_id: string;
  couple?: {
    person1_name?: string;
    person2_name?: string;
    wedding_date?: string;
    wedding_date_iso?: string;
    venue_name?: string;
    venue_city?: string;
    rsvp_deadline?: string | null;
  };
  rsvp_config?: Partial<RSVPConfig>;
  events?: Array<Omit<EventData, "id" | "couple_id">>;
};

export async function POST(request: Request) {
  let body: StructuredPatch;
  try {
    body = (await request.json()) as StructuredPatch;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.couple_id) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });

  const gate = await requireCoupleOwner(body.couple_id);
  if (gate instanceof NextResponse) return gate;

  const admin = createAdmin();

  if (body.couple) {
    const { error } = await admin.from("couples").update(body.couple).eq("id", body.couple_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.rsvp_config) {
    const merged: RSVPConfig = { ...(gate.couple.rsvp_config ?? {
      guestCountEnabled: true, guestCountMax: 4, childrenSeparate: false,
      childrenMax: 5, plusOneEnabled: false, eventSelectionEnabled: false,
      mealChoiceEnabled: false, mealOptions: [], dietaryEnabled: true,
      messageEnabled: true, songRequestEnabled: false
    }), ...body.rsvp_config };
    const { error } = await admin
      .from("couples")
      .update({ rsvp_config: merged })
      .eq("id", body.couple_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.events) {
    await admin.from("events").delete().eq("couple_id", body.couple_id);
    const rows = body.events.map((e, i) => ({
      couple_id: body.couple_id,
      name: e.name,
      event_type: e.event_type,
      event_date: e.event_date,
      event_time: e.event_time,
      venue: e.venue,
      dress_code: e.dress_code,
      sort_order: e.sort_order ?? i
    }));
    if (rows.length > 0) {
      const { error } = await admin.from("events").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  try {
    const { siteUrl } = await reRenderAndUpload(body.couple_id);
    return NextResponse.json({ site_url: siteUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
