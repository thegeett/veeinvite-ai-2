import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { buildEditPrompt } from '@/lib/ai/prompt';
import { callClaude, parseThemeJSON } from '@/lib/ai/generate';
import { mapCoupleRow, mapEventRows } from '@/lib/db/mappers';
import { readSkeleton, renderSiteFromTheme, uploadSiteHtml } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const coupleId: string | undefined = body?.coupleId;
    const instruction: string = typeof body?.instruction === 'string' ? body.instruction.trim() : '';
    if (!coupleId) {
      return NextResponse.json({ error: 'Missing coupleId' }, { status: 400 });
    }
    if (!instruction) {
      return NextResponse.json({ error: 'Missing instruction' }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: loadedRow, error: loadErr } = await supabase
      .from('couples')
      .select('*')
      .eq('id', coupleId)
      .maybeSingle();
    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }
    const preCouple = mapCoupleRow(loadedRow);
    if (!preCouple || preCouple.userId !== session.user.id) {
      return NextResponse.json({ error: 'Couple not found' }, { status: 404 });
    }
    if (!preCouple.themeJson) {
      return NextResponse.json(
        { error: 'Couple has no theme_json yet — run /api/generate first' },
        { status: 400 },
      );
    }

    // Append the instruction to style_history first so it appears in the
    // chat history even if the generation fails later.
    const newHistory = [...(preCouple.styleHistory ?? []), instruction];
    const { error: histErr } = await supabase
      .from('couples')
      .update({ style_history: newHistory })
      .eq('id', coupleId);
    if (histErr) {
      return NextResponse.json({ error: histErr.message }, { status: 500 });
    }

    // Reload couple with updated history.
    const { data: freshRow } = await supabase
      .from('couples')
      .select('*')
      .eq('id', coupleId)
      .maybeSingle();
    const couple = mapCoupleRow(freshRow)!;

    const { data: eventRows } = await supabase
      .from('events')
      .select('*')
      .eq('couple_id', coupleId)
      .order('sort_order', { ascending: true });
    const events = mapEventRows(eventRows);

    const skeleton = readSkeleton();
    const prompt = buildEditPrompt(
      skeleton,
      couple.themeJson!,
      couple,
      events,
      instruction,
    );
    const raw = await callClaude(prompt);
    const themeJson = parseThemeJSON(raw);

    const { html } = renderSiteFromTheme(themeJson, couple, events);

    const service = createServiceRoleClient();
    const siteUrl = await uploadSiteHtml(service, couple.id!, html);

    const { error: updateErr } = await supabase
      .from('couples')
      .update({ theme_json: themeJson, site_html_url: siteUrl })
      .eq('id', couple.id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await supabase.from('site_versions').insert({
      couple_id: couple.id,
      theme_json: themeJson,
      label: instruction.slice(0, 200),
    });

    return NextResponse.json({ success: true, siteUrl, themeJson });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/edit]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
