'use client';

import { LoadingScreen } from '@/components/ui/LoadingScreen';

interface Props {
  siteUrl: string | null;
  isLoading: boolean;
  loadingMessage?: string;
}

export function SitePreview({ siteUrl, isLoading, loadingMessage }: Props) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-cream/10 bg-black">
      {siteUrl ? (
        <iframe
          key={siteUrl}
          src={siteUrl}
          title="Wedding site preview"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-cream/50">
          No site yet — generate one from the onboarding quiz.
        </div>
      )}

      <LoadingScreen
        show={isLoading}
        staticText={loadingMessage ?? 'Redesigning your site...'}
        inline
      />

      {siteUrl ? (
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur border border-cream/20 px-3 py-1.5 text-xs text-cream hover:bg-black/80"
        >
          View full screen ↗
        </a>
      ) : null}
    </div>
  );
}
