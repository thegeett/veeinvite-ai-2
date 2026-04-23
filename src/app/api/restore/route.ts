// POST /api/restore — switch a couple's live site to a previous version.
//
// Plan §11: append-only. Restoring does NOT mutate the old row; it renders a
// new version using the old row's layout/theme/hero but with current couple
// data (names, dates, venues always come from `couples`, never from the
// frozen version).

import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireCoupleOwner } from "@/lib/db/auth";
import { reRenderAndUpload } from "@/lib/db/rerender";
import { rowToSiteVersion } from "@/lib/db/mappers";

interface RestoreBody {
  couple_id: string;
  version_id: string;
}

export async function POST(request: Request) {
  let body: RestoreBody;
  try {
    body = (await request.json()) as RestoreBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.couple_id || !body.version_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const gate = await requireCoupleOwner(body.couple_id);
  if (gate instanceof NextResponse) return gate;

  const admin = createAdmin();
  const { data: versionRow, error } = await admin
    .from("site_versions")
    .select("*")
    .eq("id", body.version_id)
    .eq("couple_id", body.couple_id)
    .single();
  if (error || !versionRow) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }
  const version = rowToSiteVersion(versionRow);
  if (!version.theme_json) {
    return NextResponse.json({ error: "version_missing_theme" }, { status: 400 });
  }

  await admin
    .from("couples")
    .update({
      layout_id: version.layout_id,
      theme_json: version.theme_json,
      hero_html: version.hero_html,
      global_tokens: version.global_tokens,
      design_summary: version.design_summary
    })
    .eq("id", body.couple_id);

  const { siteUrl } = await reRenderAndUpload(body.couple_id, {
    themeJson: version.theme_json,
    heroHtml: version.hero_html ?? "",
    layoutId: version.layout_id ?? "layout-1"
  });

  const { data: latestVersion } = await admin
    .from("site_versions")
    .select("version_number")
    .eq("couple_id", body.couple_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (latestVersion?.version_number ?? 0) + 1;

  const { data: newVersion } = await admin
    .from("site_versions")
    .insert({
      couple_id: body.couple_id,
      version_number: nextNumber,
      layout_id: version.layout_id,
      hero_html: version.hero_html,
      global_tokens: version.global_tokens,
      theme_json: version.theme_json,
      design_summary: version.design_summary,
      label: `Restored from v${version.version_number}`
    })
    .select("id, version_number")
    .single();

  return NextResponse.json({
    site_url: siteUrl,
    version_id: newVersion?.id,
    version_number: nextNumber,
    version_label: `Restored from v${version.version_number}`
  });
}
