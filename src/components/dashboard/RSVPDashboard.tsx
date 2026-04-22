'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  attending: boolean;
  guestCount: number;
  dietary: string | null;
  message: string | null;
  createdAt: string;
}

interface Props {
  coupleId: string;
}

export function RSVPDashboard({ coupleId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('rsvps')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false });
    setRows(
      (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        firstName: (r.first_name as string) ?? '',
        lastName: (r.last_name as string) ?? '',
        email: (r.email as string) ?? '',
        attending: (r.attending as boolean) ?? false,
        guestCount: (r.guest_count as number) ?? 1,
        dietary: (r.dietary as string | null) ?? null,
        message: (r.message as string | null) ?? null,
        createdAt: (r.created_at as string) ?? '',
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  const total = rows.length;
  const attending = rows.filter((r) => r.attending).length;
  const declining = rows.filter((r) => !r.attending).length;

  function exportCsv() {
    const head = [
      'First name',
      'Last name',
      'Email',
      'Attending',
      'Guests',
      'Dietary',
      'Message',
      'Submitted',
    ];
    const body = rows.map((r) => [
      r.firstName,
      r.lastName,
      r.email,
      r.attending ? 'Yes' : 'No',
      String(r.guestCount),
      r.dietary || '',
      r.message || '',
      r.createdAt,
    ]);
    const csv = [head, ...body]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'veeinvite-rsvps.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl">RSVPs</h2>
          <p className="text-sm text-cream/60 mt-1">
            Guest responses appear here as they arrive.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-cream/20 px-4 py-2 text-xs text-cream/80 hover:bg-cream/5"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded-full bg-cream text-ink px-4 py-2 text-xs font-medium disabled:opacity-40 hover:bg-white"
          >
            Export CSV
          </button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Total responses" value={total} />
        <SummaryCard label="Attending" value={attending} />
        <SummaryCard label="Declining" value={declining} />
      </div>

      <div className="mt-6 rounded-xl border border-cream/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-[0.18em] text-cream/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Attending</th>
              <th className="px-4 py-3">Guests</th>
              <th className="px-4 py-3">Dietary</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-cream/50">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-cream/50">
                  No RSVPs yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-cream/10">
                  <td className="px-4 py-3 text-cream">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="px-4 py-3 text-cream/80">{r.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                        r.attending
                          ? 'bg-green-500/20 text-green-200'
                          : 'bg-red-500/20 text-red-200'
                      }`}
                    >
                      {r.attending ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cream/80">{r.guestCount}</td>
                  <td className="px-4 py-3 text-cream/80">{r.dietary || '—'}</td>
                  <td className="px-4 py-3 text-cream/80">
                    {r.message ? (
                      <span className="line-clamp-2" title={r.message}>
                        {r.message}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-cream/60">
                    {formatDate(r.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-cream/10 p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-cream/50">{label}</div>
      <div className="mt-2 font-serif text-3xl">{value}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
