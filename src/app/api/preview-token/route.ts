// POST /api/preview-token — generate a shareable /preview/[token] link.
//
// Plan §32 Hook 3. 7-day expiry. The rendered preview HTML differs from the
// live site in two ways (the renderer owns the swaps — see ARCHITECTURE.md):
//   1. The RSVP form is replaced by a "Create yours" CTA linking to /signup.
//   2. The "Powered by VeeInvite" footer is more prominent.
//
// Stream C only orchestrates: render via Stream B's renderer (with the
// `previewMode` flag in RenderInput — pending TYPES addition from Stream B),
// upload to preview-sites, insert preview_tokens row, return the URL.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireCoupleOwner } from "@/lib/db/auth";
import { uploadPreviewHtml } from "@/lib/storage/html";
import { render } from "@/lib/renderer";
import { rowToEvent } from "@/lib/db/mappers";

interface PreviewBody {
  couple_id: string;
}

const PREVIEW_EXPIRY_DAYS = 7;

function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: Request) {
  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.couple_id) return NextResponse.json({ error: "missing_couple_id" }, { status: 400 });

  const gate = await requireCoupleOwner(body.couple_id);
  if (gate instanceof NextResponse) return gate;
  const couple = gate.couple;
  if (!couple.theme_json || !couple.layout_id) {
    return NextResponse.json({ error: "not_generated_yet" }, { status: 400 });
  }

  const admin = createAdmin();
  const { data: eventRows } = await admin
    .from("events")
    .select("*")
    .eq("couple_id", body.couple_id)
    .order("sort_order");
  const events = (eventRows ?? []).map(rowToEvent);

  // Render with the standard renderer. Stream B's renderer recognises a
  // `previewMode` flag on RenderInput — until that flag is wired, we
  // post-process the HTML with a simple replace to swap RSVP form → CTA.
  const liveHtml = render({
    layoutId: couple.layout_id,
    themeJson: couple.theme_json,
    heroHtml: couple.hero_html ?? "",
    culturalProfile: couple.cultural_profile,
    couple,
    events,
    rsvpConfig: couple.rsvp_config ?? {
      guestCountEnabled: true, guestCountMax: 4, childrenSeparate: false,
      childrenMax: 5, plusOneEnabled: false, eventSelectionEnabled: false,
      mealChoiceEnabled: false, mealOptions: [], dietaryEnabled: true,
      messageEnabled: true, songRequestEnabled: false
    },
    customSections: couple.custom_sections
  });

  const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/signup?source=guest_preview&site=${couple.slug}`;
  const ctaHtml = `<section id="rsvp" class="preview-cta" style="padding:6rem 2rem;text-align:center">
  <h2>Want a site like this for your wedding?</h2>
  <p>VeeInvite generates a full wedding website in two minutes.</p>
  <a href="${signupUrl}" style="display:inline-block;padding:1rem 2rem;margin-top:1rem;background:#C4607A;color:#fff;text-decoration:none;border-radius:999px">Create yours →</a>
</section>`;
  const previewHtml = liveHtml
    .replace(/<section[^>]*id=["']rsvp["'][\s\S]*?<\/section>/i, ctaHtml)
    .replace(/<footer\b/i, '<footer data-preview-mode="true"');

  const token = randomToken();
  await uploadPreviewHtml(token, previewHtml);

  const expiresAt = new Date(Date.now() + PREVIEW_EXPIRY_DAYS * 86_400_000);
  const { error } = await admin.from("preview_tokens").insert({
    token,
    couple_id: body.couple_id,
    expires_at: expiresAt.toISOString()
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    preview_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/preview/${token}`,
    token,
    expires_at: expiresAt.toISOString()
  });
}
