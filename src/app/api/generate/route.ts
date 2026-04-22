import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { buildPrompt } from '@/lib/ai/prompt';
import { callClaude, parseThemeJSON } from '@/lib/ai/generate';
import { mapCoupleRow, mapEventRows } from '@/lib/db/mappers';
import { readSkeleton, renderSiteFromTheme, uploadSiteHtml } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const coupleId: string | undefined = body?.coupleId;
    if (!coupleId) {
      return NextResponse.json({ error: 'Missing coupleId' }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: coupleRow, error: coupleErr } = await supabase
      .from('couples')
      .select('*')
      .eq('id', coupleId)
      .maybeSingle();
    if (coupleErr) {
      return NextResponse.json({ error: coupleErr.message }, { status: 500 });
    }
    const couple = mapCoupleRow(coupleRow);
    if (!couple || couple.userId !== session.user.id) {
      return NextResponse.json({ error: 'Couple not found' }, { status: 404 });
    }

    const { data: eventRows, error: eventsErr } = await supabase
      .from('events')
      .select('*')
      .eq('couple_id', coupleId)
      .order('sort_order', { ascending: true });
    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }
    const events = mapEventRows(eventRows);

    const skeleton = readSkeleton();
    const prompt = buildPrompt(skeleton, couple, events);
    const raw = await callClaude(prompt);
    const themeJson = parseThemeJSON(raw);

    const { html } = renderSiteFromTheme(themeJson, couple, events);

    const service = createServiceRoleClient();
    const siteUrl = await uploadSiteHtml(service, couple.id!, html);

    const { error: updateErr } = await supabase
      .from('couples')
      .update({
        theme_json: themeJson,
        site_html_url: siteUrl,
        is_published: true,
      })
      .eq('id', couple.id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await supabase.from('site_versions').insert({
      couple_id: couple.id,
      theme_json: themeJson,
      label: 'Initial generation',
    });

    return NextResponse.json({ success: true, siteUrl, themeJson });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/generate]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
