"use client";

import { useEffect, useMemo, useState } from "react";
import type { RSVPData } from "@/lib/types";

type Props = { coupleId: string; ceremonyIds: string[] };

/**
 * RSVP couple dashboard (plan §16 VI-F013).
 * - Filter by ceremony when multi-event.
 * - CSV export calls Stream C's export endpoint (or falls back to a client-side
 *   CSV download in fixture mode so demos always work).
 */
export function RSVPDashboard({ coupleId, ceremonyIds }: Props) {
  const [rsvps, setRsvps] = useState<RSVPData[] | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/rsvp?coupleId=${coupleId}`);
      if (r.ok && !cancelled) setRsvps(await r.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [coupleId]);

  const filtered = useMemo(() => {
    if (!rsvps) return [];
    if (filter === "all") return rsvps;
    if (filter === "declined") return rsvps.filter((r) => !r.attending);
    if (filter === "attending") return rsvps.filter((r) => r.attending);
    return rsvps.filter((r) => r.events_attending.includes(filter));
  }, [rsvps, filter]);

  const stats = useMemo(() => {
    if (!rsvps) return { total: 0, attending: 0, declined: 0, guests: 0 };
    return {
      total: rsvps.length,
      attending: rsvps.filter((r) => r.attending).length,
      declined: rsvps.filter((r) => !r.attending).length,
      guests: rsvps
        .filter((r) => r.attending)
        .reduce((acc, r) => acc + (r.guest_count || 0) + (r.children_count || 0), 0)
    };
  }, [rsvps]);

  function exportCSV() {
    // Client-side CSV — works even offline. Stream C's /api/rsvp/export also
    // exists but for the dashboard a client-side download avoids a round-trip
    // and works on filtered subsets without extra server params.
    const rows = filtered.map(rsvpToRow);
    downloadCSV(rows);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="veein-meta mb-2 text-stone">§ Your RSVPs</div>
          <p className="text-sm text-ink/70 max-w-md">
            Real-time responses from your guests. Export for the caterer or the family
            WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          className="rounded-full border border-ink px-4 py-1.5 text-sm hover:bg-ink hover:text-canvas transition-colors"
        >
          Download CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total responses" value={stats.total} />
        <Stat label="Joining" value={stats.attending} />
        <Stat label="Declined" value={stats.declined} />
        <Stat label="Head count" value={stats.guests} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        <Chip active={filter === "attending"} onClick={() => setFilter("attending")}>
          Attending
        </Chip>
        <Chip active={filter === "declined"} onClick={() => setFilter("declined")}>
          Declined
        </Chip>
        {ceremonyIds.length > 1 ? (
          <>
            <span className="veein-meta text-stone mx-2">by event</span>
            {ceremonyIds.map((id) => (
              <Chip key={id} active={filter === id} onClick={() => setFilter(id)}>
                {prettifyId(id)}
              </Chip>
            ))}
          </>
        ) : null}
      </div>

      {rsvps === null ? (
        <p className="veein-meta text-stone">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="veein-meta text-stone">No responses match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="veein-meta py-3 pr-3">Guest</th>
                <th className="veein-meta py-3 pr-3">Email</th>
                <th className="veein-meta py-3 pr-3">Attending</th>
                <th className="veein-meta py-3 pr-3">Count</th>
                <th className="veein-meta py-3 pr-3">Events</th>
                <th className="veein-meta py-3 pr-3">Dietary</th>
                <th className="veein-meta py-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-line/60 align-top">
                  <td className="py-3 pr-3 font-serif text-base">
                    {r.first_name} {r.last_name}
                    {r.plus_one_name ? <div className="text-xs text-stone">+ {r.plus_one_name}</div> : null}
                  </td>
                  <td className="py-3 pr-3 text-ink/70">{r.email}</td>
                  <td className="py-3 pr-3">
                    {r.attending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-paper border border-line px-2 py-0.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-blush inline-block" /> Yes
                      </span>
                    ) : (
                      <span className="text-stone text-xs">No</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {r.attending ? `${r.guest_count}${r.children_count ? ` (+${r.children_count} ch.)` : ""}` : "—"}
                  </td>
                  <td className="py-3 pr-3 text-ink/70">
                    {r.events_attending.length > 0 ? r.events_attending.map(prettifyId).join(", ") : "—"}
                  </td>
                  <td className="py-3 pr-3 text-ink/70">{r.dietary ?? "—"}</td>
                  <td className="py-3 text-ink/70">{r.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-paper p-4">
      <div className="veein-meta text-stone">{label}</div>
      <div className="font-serif text-3xl mt-1">{value}</div>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active ? "bg-ink text-canvas" : "bg-paper border border-line hover:border-ink/40"
      }`}
    >
      {children}
    </button>
  );
}

function prettifyId(id: string): string {
  return id.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function rsvpToRow(r: RSVPData) {
  return {
    name: `${r.first_name} ${r.last_name}`,
    email: r.email,
    attending: r.attending ? "Yes" : "No",
    guests: r.guest_count,
    children: r.children_count,
    plus_one: r.plus_one_name ?? "",
    events: r.events_attending.join("; "),
    meal: r.meal_choice ?? "",
    dietary: r.dietary ?? "",
    song: r.song_request ?? "",
    message: r.message ?? ""
  };
}

function downloadCSV(rows: ReturnType<typeof rsvpToRow>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(",")).join("\n");
  const csv = [headers.join(","), body].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
