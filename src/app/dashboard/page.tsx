"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SitePreview, PickedElement } from "@/components/dashboard/SitePreview";
import { EditPanel } from "@/components/dashboard/EditPanel";
import { StructuredEditor } from "@/components/dashboard/StructuredEditor";
import { VersionHistory } from "@/components/dashboard/VersionHistory";
import { RSVPDashboard } from "@/components/dashboard/RSVPDashboard";
import { PhotoUpload } from "@/components/dashboard/PhotoUpload";
import type { CoupleData } from "@/lib/types";

type Tab = "edit" | "structured" | "versions" | "rsvp" | "photos";

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}

function Loading() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-[1600px] px-4 pt-8 md:px-8">
        <span className="veein-meta">Opening your dashboard…</span>
      </div>
    </main>
  );
}

function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const coupleId = params.get("couple");
  const initialSlug = params.get("slug") ?? "your-wedding";

  const [couple, setCouple] = useState<Partial<CoupleData> | null>(null);
  const [picked, setPicked] = useState<PickedElement>(null);
  const [tab, setTab] = useState<Tab>("edit");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // No couple id means the user hit /dashboard directly without completing
    // onboarding — send them through the flow.
    if (!coupleId) {
      router.push("/onboarding");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/couple?id=${coupleId}`);
        if (r.status === 401) {
          router.push(`/auth/login?next=${encodeURIComponent(`/dashboard?couple=${coupleId}`)}`);
          return;
        }
        if (r.status === 404) {
          // Couple id in URL is stale — restart onboarding.
          router.push("/onboarding");
          return;
        }
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          if (!cancelled) setLoadError(body.error ?? "Could not load your wedding.");
          return;
        }
        if (!cancelled) setCouple(await r.json());
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coupleId, router]);

  const slug = couple?.slug ?? initialSlug;
  const layoutId = couple?.layout_id ?? "layout-1";
  const ceremonyIds = couple?.cultural_profile?.ceremonies?.map((c) => c.id) ?? [];

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function onPublish() {
    if (!coupleId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const r = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple_id: coupleId })
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Publish failed");
      }
      setCouple((prev) => ({ ...prev, is_published: true }));
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  async function onSharePreview() {
    if (!coupleId) return;
    try {
      const r = await fetch("/api/preview-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple_id: coupleId })
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        alert(body.error ?? "Could not create a preview link. Try again once your design is ready.");
        return;
      }
      const data = (await r.json()) as { preview_url: string };
      await navigator.clipboard.writeText(data.preview_url).catch(() => {});
      alert(`Preview link copied to clipboard:\n${data.preview_url}\n\n(Expires in 7 days.)`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  if (!coupleId) {
    // useEffect has already dispatched the redirect; render nothing in the meantime.
    return null;
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      {loadError ? (
        <div className="border-b border-blush/40 bg-blush/5 px-4 py-2 text-center text-sm text-blush">
          {loadError}
        </div>
      ) : null}
      {publishError ? (
        <div className="border-b border-blush/40 bg-blush/5 px-4 py-2 text-center text-sm text-blush">
          Publish error: {publishError}
        </div>
      ) : null}
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-xl italic">Vee</span>
            <span className="veein-meta">INVITE</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="veein-meta text-stone hidden sm:inline">
              {couple ? (
                <>
                  {couple.person1_name} &amp; {couple.person2_name} · {couple.wedding_date}
                </>
              ) : (
                "Loading…"
              )}
            </span>
            <button
              type="button"
              onClick={onSharePreview}
              className="rounded-full border border-ink px-4 py-1.5 text-sm hover:bg-ink hover:text-canvas transition-colors"
            >
              Share preview
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={publishing || couple?.is_published}
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-canvas disabled:opacity-60"
            >
              {couple?.is_published ? "Published" : publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 md:px-8 lg:grid-cols-[1fr_460px]">
        {/* Preview pane */}
        <section>
          <SitePreview
            slug={slug}
            layoutId={layoutId}
            picked={picked}
            onPick={setPicked}
            useFallback={false}
          />
        </section>

        {/* Right pane — tabbed editor */}
        <aside className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-1 rounded-full bg-paper border border-line p-1">
            <Tab id="edit" tab={tab} onClick={setTab}>Edit</Tab>
            <Tab id="structured" tab={tab} onClick={setTab}>Details</Tab>
            <Tab id="versions" tab={tab} onClick={setTab}>Your designs</Tab>
            <Tab id="rsvp" tab={tab} onClick={setTab}>RSVPs</Tab>
            <Tab id="photos" tab={tab} onClick={setTab}>Photos</Tab>
          </div>
          <div className="rounded-md border border-line bg-canvas p-5 min-h-[500px]">
            {tab === "edit" ? (
              <EditPanel
                coupleId={coupleId}
                picked={picked}
                onClearPick={() => setPicked(null)}
              />
            ) : null}
            {tab === "structured" && couple ? (
              <StructuredEditor
                couple={couple}
                onSaved={(next) => setCouple((prev) => ({ ...prev, ...next }))}
              />
            ) : null}
            {tab === "versions" ? <VersionHistory coupleId={coupleId} /> : null}
            {tab === "rsvp" ? (
              <RSVPDashboard coupleId={coupleId} ceremonyIds={ceremonyIds} />
            ) : null}
            {tab === "photos" ? (
              <PhotoUpload coupleId={coupleId} existing={couple?.photo_urls ?? []} />
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Tab({
  id,
  tab,
  onClick,
  children
}: {
  id: "edit" | "structured" | "versions" | "rsvp" | "photos";
  tab: string;
  onClick: (t: typeof id) => void;
  children: React.ReactNode;
}) {
  const active = tab === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink/70 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
