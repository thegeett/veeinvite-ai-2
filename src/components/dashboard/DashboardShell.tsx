'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import type { CoupleData } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { SitePreview } from './SitePreview';
import { StructuredEditor } from './StructuredEditor';
import { EditPanel } from './EditPanel';
import { RSVPDashboard } from './RSVPDashboard';

interface Props {
  initialCouple: CoupleData;
}

export default function DashboardShell({ initialCouple }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [couple, setCouple] = useState<CoupleData>(initialCouple);
  const [siteUrl, setSiteUrl] = useState<string | null>(initialCouple.siteHtmlUrl ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!couple.slug) return '';
    if (!base) return `/w/${couple.slug}`;
    return `${base.replace(/\/$/, '')}/w/${couple.slug}`;
  }, [couple.slug]);

  const refreshCouple = useCallback(
    async (updatedUrl?: string | null) => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('couples')
          .select('*')
          .eq('id', couple.id)
          .maybeSingle();
        if (data) {
          const updated: CoupleData = {
            ...couple,
            person1Name: (data.person1_name as string) ?? couple.person1Name,
            person2Name: (data.person2_name as string) ?? couple.person2Name,
            weddingDate: (data.wedding_date as string) ?? couple.weddingDate,
            weddingDateIso: (data.wedding_date_iso as string) ?? couple.weddingDateIso,
            venueName: (data.venue_name as string) ?? couple.venueName,
            venueCity: (data.venue_city as string) ?? couple.venueCity,
            rsvpDeadline: (data.rsvp_deadline as string | null) ?? undefined,
            styleHistory: (data.style_history as string[] | null) ?? couple.styleHistory ?? [],
            siteHtmlUrl: (data.site_html_url as string | null) ?? couple.siteHtmlUrl,
          };
          setCouple(updated);
          setSiteUrl(updatedUrl ?? (data.site_html_url as string | null) ?? couple.siteHtmlUrl ?? null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [couple, supabase],
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  async function copyUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-ink text-cream">
      <header className="flex items-center justify-between gap-6 border-b border-cream/10 px-6 py-4">
        <Link href="/dashboard" className="font-serif text-xl tracking-wider">
          VeeInvite
        </Link>
        <div className="flex items-center gap-2">
          {publicUrl ? (
            <button
              type="button"
              onClick={copyUrl}
              title={publicUrl}
              className="hidden md:inline rounded-full border border-cream/15 px-3 py-1.5 text-xs text-cream/80 hover:bg-cream/5"
            >
              {copied ? 'Copied!' : publicUrl.replace(/^https?:\/\//, '')}
            </button>
          ) : null}
          {siteUrl ? (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline rounded-full border border-cream/15 px-3 py-1.5 text-xs text-cream/80 hover:bg-cream/5"
            >
              View live ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-cream/15 px-3 py-1.5 text-xs text-cream/80 hover:bg-cream/5"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="px-6 py-6 grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,35%)_minmax(0,65%)]">
        <section className="flex flex-col gap-6">
          <div>
            <h1 className="font-serif text-3xl leading-tight">
              {couple.person1Name} &amp; {couple.person2Name}
            </h1>
            <p className="mt-1 text-sm text-cream/60">
              {couple.weddingDate} · {couple.venueName}, {couple.venueCity}
            </p>
          </div>

          <div className="rounded-xl border border-cream/10 p-5">
            <h2 className="font-serif text-lg mb-3">Details</h2>
            <p className="text-xs text-cream/50 mb-4">
              Changes here update the preview instantly — no AI call.
            </p>
            <StructuredEditor couple={couple} onUpdate={refreshCouple} />
          </div>

          <div className="rounded-xl border border-cream/10 p-5">
            <h2 className="font-serif text-lg mb-3">Redesign with AI</h2>
            <EditPanel
              coupleId={couple.id!}
              history={couple.styleHistory ?? []}
              onEdit={(url) => setSiteUrl(url)}
              onHistoryChange={(next) =>
                setCouple((c) => ({ ...c, styleHistory: next }))
              }
              onLoadingChange={setIsLoading}
            />
          </div>
        </section>

        <section className="min-h-[70vh] lg:h-[80vh]">
          <SitePreview siteUrl={siteUrl} isLoading={isLoading} />
        </section>

        <section className="col-span-1 lg:col-span-2">
          <RSVPDashboard coupleId={couple.id!} />
        </section>
      </main>
    </div>
  );
}
