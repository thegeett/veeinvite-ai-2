import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RSVPBody {
  slug?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  attending?: boolean | string;
  guestCount?: number | string;
  dietary?: string;
  message?: string;
}

function normaliseAttending(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    return s === 'yes' || s === 'true' || s === '1';
  }
  return false;
}

function normaliseGuestCount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(20, Math.floor(n)));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RSVPBody;
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    if (!firstName) return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    if (!lastName) return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const service = createServiceRoleClient();

    const { data: couple, error: coupleErr } = await service
      .from('couples')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (coupleErr) {
      return NextResponse.json({ error: coupleErr.message }, { status: 500 });
    }
    if (!couple) {
      return NextResponse.json({ error: 'Wedding not found' }, { status: 404 });
    }

    const payload = {
      couple_id: couple.id,
      first_name: firstName,
      last_name: lastName,
      email,
      attending: normaliseAttending(body.attending),
      guest_count: normaliseGuestCount(body.guestCount),
      dietary: typeof body.dietary === 'string' ? body.dietary.trim() || null : null,
      message: typeof body.message === 'string' ? body.message.trim() || null : null,
    };

    const { error: insErr } = await service.from('rsvps').insert(payload);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/rsvp]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
