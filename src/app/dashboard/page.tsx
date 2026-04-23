"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SitePreview, PickedElement } from "@/components/dashboard/SitePreview";
import { EditPanel } from "@/components/dashboard/EditPanel";
import { StructuredEditor } from "@/components/dashboard/StructuredEditor";
import { VersionHistory } from "@/components/dashboard/VersionHistory";
import { RSVPDashboard } from "@/components/dashboard/RSVPDashboard";
import { PhotoUpload } from "@/components/dashboard/PhotoUpload";
import { loadCouple, USE_FIXTURES } from "@/lib/fixtures/api";
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
  const coupleId = params.get("couple") ?? "fixture-couple-00000000";
  const initialSlug = params.get("slug") ?? "your-wedding";

  const [couple, setCouple] = useState<Partial<CoupleData> | null>(null);
  const [picked, setPicked] = useState<PickedElement>(null);
  const [tab, setTab] = useState<Tab>("edit");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (process.env.NODE_ENV === "development" && USE_FIXTURES) {
        const c = await loadCouple();
        if (!cancelled) setCouple(c);
      } else {
        const r = await fetch(`/api/couple?id=${coupleId}`);
        if (r.ok && !cancelled) setCouple(await r.json());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coupleId]);

  const slug = couple?.slug ?? initialSlug;
  const layoutId = couple?.layout_id ?? "layout-1";
  const ceremonyIds = couple?.cultural_profile?.ceremonies?.map((c) => c.id) ?? [];

  return (
    <main className="min-h-screen bg-canvas text-ink">
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
            <Link
              href={`/preview/placeholder-token`}
              className="rounded-full border border-ink px-4 py-1.5 text-sm hover:bg-ink hover:text-canvas transition-colors"
            >
              Share preview
            </Link>
            <button
              type="button"
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-canvas"
              onClick={async () => {
                if (!(process.env.NODE_ENV === "development" && USE_FIXTURES)) {
                  await fetch("/api/publish", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ coupleId })
                  });
                }
                alert("Publish flow — Stream C wires this to Stripe + is_published.");
              }}
            >
              Publish
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
            useFallback={process.env.NODE_ENV === "development" && USE_FIXTURES}
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
