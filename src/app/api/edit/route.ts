// POST /api/edit — chat edit with classifier routing.
//
// Plan §12 (classifier), §30 (content/element picker), §11 (versions append-only).
//
// Flow:
//   1. Classify the instruction via runClassifier().
//   2. Route by classification:
//        - data         → delegate to /api/structured via a shared helper
//        - content      → targeted content rewrite → theme.content → re-render
//        - design       → Call 2 rerun → new theme + hero preserved → re-render
//        - hero         → Call 3 rerun → new hero, theme preserved → re-render
//        - global       → Call 2 + Call 3 → full redesign → re-render
//        - new_section  → M2 (501 for now)
//   3. Always: update Supabase AND rewrite HTML. Insert site_versions row.

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireCoupleOwner } from "@/lib/db/auth";
import { reRenderAndUpload } from "@/lib/db/rerender";
import { runCall2, runCall3, runClassifier } from "@/lib/ai/generate";
import type { ChatEditInput, LayoutId, ThemeJSON } from "@/lib/types";

interface EditBody {
  couple_id: string;
  instruction: string;
  content_picker_target?: string;
  element_picker_selectors?: string[];
}

export async function POST(request: Request) {
  let body: EditBody;
  try {
    body = (await request.json()) as EditBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.couple_id || !body.instruction) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const gate = await requireCoupleOwner(body.couple_id);
  if (gate instanceof NextResponse) return gate;
  const couple = gate.couple;

  if (!couple.theme_json || !couple.layout_id) {
    return NextResponse.json({ error: "not_generated_yet" }, { status: 400 });
  }

  const classifierInput: ChatEditInput = {
    coupleId: body.couple_id,
    instruction: body.instruction,
    contentPickerTarget: body.content_picker_target,
    elementPickerSelectors: body.element_picker_selectors
  };

  const classification = await runClassifier({
    instruction: body.instruction,
    contentPickerTarget: body.content_picker_target,
    elementPickerSelectors: body.element_picker_selectors
  });

  const admin = createAdmin();

  let nextTheme: ThemeJSON = couple.theme_json;
  let nextHero: string = couple.hero_html ?? "";
  const layoutId: LayoutId = couple.layout_id;

  switch (classification.type) {
    case "new_section":
      return NextResponse.json({ error: "not_implemented_m1" }, { status: 501 });

    case "content": {
      // Targeted content rewrite: bump a single placeholder in theme.content.
      const target = classification.target ?? body.content_picker_target;
      if (target) {
        // Stream B owns the per-field rewrite prompt; until wired, seed the
        // instruction text into the placeholder so the edit is at least visible.
        nextTheme = {
          ...couple.theme_json,
          content: { ...couple.theme_json.content, [target]: body.instruction }
        };
      }
      break;
    }

    case "data":
      return NextResponse.json(
        { error: "use_structured_endpoint", hint: "POST /api/structured" },
        { status: 400 }
      );

    case "design": {
      nextTheme = await runCall2({
        skeletonHtml: "", // Stream B's Call 2 loads the skeleton itself.
        layoutId,
        couple,
        culturalProfile: couple.cultural_profile,
        tags: []
      });
      break;
    }

    case "hero": {
      nextHero = await runCall3({
        globalTokens: couple.global_tokens ?? couple.theme_json.globalTokens,
        couple,
        culturalProfile: couple.cultural_profile
      });
      break;
    }

    case "global": {
      nextTheme = await runCall2({
        skeletonHtml: "",
        layoutId,
        couple,
        culturalProfile: couple.cultural_profile,
        tags: []
      });
      nextHero = await runCall3({
        globalTokens: nextTheme.globalTokens,
        couple,
        culturalProfile: couple.cultural_profile
      });
      break;
    }
  }

  // Persist DB, then re-render, then version-row (rule: DB + HTML together).
  await admin
    .from("couples")
    .update({
      theme_json: nextTheme,
      hero_html: nextHero,
      global_tokens: nextTheme.globalTokens,
      design_summary: nextTheme.designSummary
    })
    .eq("id", body.couple_id);

  const { siteUrl, html } = await reRenderAndUpload(body.couple_id, {
    themeJson: nextTheme,
    heroHtml: nextHero
  });

  const { data: latestVersion } = await admin
    .from("site_versions")
    .select("version_number")
    .eq("couple_id", body.couple_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (latestVersion?.version_number ?? 0) + 1;

  await admin.from("site_versions").insert({
    couple_id: body.couple_id,
    version_number: nextNumber,
    layout_id: layoutId,
    hero_html: nextHero,
    global_tokens: nextTheme.globalTokens,
    theme_json: nextTheme,
    design_summary: nextTheme.designSummary,
    instruction: classifierInput.instruction,
    label: `${classification.type} edit (v${nextNumber})`
  });

  return NextResponse.json({
    site_url: siteUrl,
    version_number: nextNumber,
    version_label: `${classification.type} edit (v${nextNumber})`,
    classification: classification.type,
    preview_html: html.slice(0, 2000)
  });
}
