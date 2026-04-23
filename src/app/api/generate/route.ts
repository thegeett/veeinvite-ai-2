// POST /api/generate — quiz step 1 or step 2 submission.
//
// Plan §4 pipeline, §28 step 1 contract, §23 VI-F002.
//
// Flow:
//   1. Authenticate user.
//   2. Upsert `couples` row with names/date/venue (+ cultural profile + rsvp
//      config + events on step 2).
//   3. Call pipeline.generateSite() — Stream B's orchestrator.
//   4. Insert append-only `site_versions` row.
//   5. Upload HTML to private `invitation-sites/{slug}.html`.
//   6. Update `couples` with derived AI outputs.
//   7. Return slug + site_url + a short preview.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { generateSite } from "@/lib/pipeline";
import { uploadSiteHtml } from "@/lib/storage/html";
import { slugifyNames, rowToCouple } from "@/lib/db/mappers";
import { smartDefaultsForProfile } from "@/lib/rsvp/config";
import { buildCulturalProfile } from "@/lib/cultural/library";
import type { QuizStep1Answers, QuizStep2Answers } from "@/lib/types";

interface GenerateBody {
  step: 1 | 2;
  couple_id?: string;
  answers: QuizStep1Answers | QuizStep2Answers;
}

function isStep1(a: GenerateBody["answers"]): a is QuizStep1Answers {
  return "wedding_date_iso" in a && "person1_name" in a && !("vibeWords" in a);
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const admin = createAdmin();
  let coupleId = body.couple_id;

  // --- Step 1: upsert the base couple row ---------------------------------
  if (body.step === 1 && isStep1(body.answers)) {
    const a = body.answers;
    const slug = slugifyNames(a.person1_name, a.person2_name);
    const { data: inserted, error } = await admin
      .from("couples")
      .insert({
        user_id: user.id,
        slug,
        person1_name: a.person1_name,
        person2_name: a.person2_name,
        wedding_date: a.wedding_date,
        wedding_date_iso: a.wedding_date_iso,
        venue_name: a.venue_name,
        venue_city: a.venue_city
      })
      .select("*")
      .single();
    if (error || !inserted) {
      return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
    }
    coupleId = inserted.id;
  }

  // --- Step 2: update quiz answers + insert events -------------------------
  if (body.step === 2 && !isStep1(body.answers)) {
    if (!coupleId) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });
    const owned = await admin
      .from("couples")
      .select("user_id")
      .eq("id", coupleId)
      .single();
    if (!owned.data || owned.data.user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const a = body.answers as QuizStep2Answers;
    const culturalProfile = a.cultureId
      ? buildCulturalProfile(
          a.cultureId,
          a.subRegion,
          a.confirmedContentItemIds,
          a.confirmedCeremonyIds,
          a.contentValues
        )
      : null;

    const rsvpConfig = smartDefaultsForProfile(culturalProfile);

    const { error: updErr } = await admin
      .from("couples")
      .update({
        style: a.styleCard ?? null,
        vibe: a.vibeWords?.join(",") ?? null,
        story: a.story ?? null,
        cultural_context: a.cultureId ?? null,
        cultural_profile: culturalProfile,
        rsvp_config: rsvpConfig
      })
      .eq("id", coupleId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    if (a.events && a.events.length > 0) {
      await admin.from("events").delete().eq("couple_id", coupleId);
      const rows = a.events.map((e, i) => ({
        couple_id: coupleId,
        name: e.name,
        event_type: e.event_type,
        event_date: e.event_date,
        event_time: e.event_time,
        venue: e.venue,
        dress_code: e.dress_code,
        sort_order: e.sort_order ?? i
      }));
      const { error: evErr } = await admin.from("events").insert(rows);
      if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
    }
  }

  if (!coupleId) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });

  // --- Run the pipeline ---------------------------------------------------
  const output = await generateSite({
    quizAnswers: body.answers,
    existingCoupleId: coupleId
  });

  // --- Persist generated artefacts ----------------------------------------
  const { data: coupleRow, error: reReadErr } = await admin
    .from("couples")
    .select("*")
    .eq("id", coupleId)
    .single();
  if (reReadErr || !coupleRow) {
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  const couple = rowToCouple(coupleRow);

  await uploadSiteHtml(couple.slug, output.html);

  // Append-only version history (§11)
  const { data: latestVersion } = await admin
    .from("site_versions")
    .select("version_number")
    .eq("couple_id", coupleId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latestVersion?.version_number ?? 0) + 1;

  await admin.from("site_versions").insert({
    couple_id: coupleId,
    version_number: nextVersion,
    layout_id: output.layoutId,
    hero_html: output.heroHtml,
    global_tokens: output.globalTokens,
    theme_json: output.themeJson,
    design_summary: output.designSummary,
    label: body.step === 1 ? "Initial generation" : `Step 2 regeneration (v${nextVersion})`
  });

  await admin
    .from("couples")
    .update({
      layout_id: output.layoutId,
      theme_json: output.themeJson,
      hero_html: output.heroHtml,
      global_tokens: output.globalTokens,
      design_summary: output.designSummary,
      site_html_url: `/w/${couple.slug}`,
      cultural_profile: output.culturalProfile ?? couple.cultural_profile
    })
    .eq("id", coupleId);

  const siteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/w/${couple.slug}`;
  return NextResponse.json({
    couple_id: coupleId,
    slug: couple.slug,
    site_url: siteUrl,
    version_number: nextVersion,
    preview_html: output.html.slice(0, 2000)
  });
}
