import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { mapCoupleRow, mapEventRows } from '@/lib/db/mappers';
import { renderSiteFromTheme, uploadSiteHtml } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_FIELDS = new Set<string>([
  'person1_name',
  'person2_name',
  'wedding_date',
  'wedding_date_iso',
  'venue_name',
  'venue_city',
  'rsvp_deadline',
]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const coupleId: string | undefined = body?.coupleId;
    const field: string | undefined = body?.field;
    const value: unknown = body?.value;
    if (!coupleId || !field) {
      return NextResponse.json({ error: 'Missing coupleId or field' }, { status: 400 });
    }
    if (!ALLOWED_FIELDS.has(field)) {
      return NextResponse.json({ error: `Field "${field}" is not editable here` }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: ownedRow, error: fetchErr } = await supabase
      .from('couples')
      .select('id, user_id')
      .eq('id', coupleId)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!ownedRow || ownedRow.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Couple not found' }, { status: 404 });
    }

    const update: Record<string, unknown> = { [field]: value ?? null };
    const { error: updateErr } = await supabase
      .from('couples')
      .update(update)
      .eq('id', coupleId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { data: freshRow } = await supabase
      .from('couples')
      .select('*')
      .eq('id', coupleId)
      .maybeSingle();
    const couple = mapCoupleRow(freshRow);
    if (!couple) {
      return NextResponse.json({ error: 'Couple not found after update' }, { status: 404 });
    }

    const { data: eventRows } = await supabase
      .from('events')
      .select('*')
      .eq('couple_id', coupleId)
      .order('sort_order', { ascending: true });
    const events = mapEventRows(eventRows);

    let siteUrl = couple.siteHtmlUrl ?? null;
    if (couple.themeJson && couple.siteHtmlUrl) {
      const { html } = renderSiteFromTheme(couple.themeJson, couple, events);
      const service = createServiceRoleClient();
      siteUrl = await uploadSiteHtml(service, couple.id!, html);
      await supabase
        .from('couples')
        .update({ site_html_url: siteUrl })
        .eq('id', couple.id);
    }

    return NextResponse.json({ success: true, siteUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/structured]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
