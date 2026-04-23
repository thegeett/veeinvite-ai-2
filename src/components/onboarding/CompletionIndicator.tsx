"use client";

type Item = { label: string; state: "done" | "partial" | "todo"; action?: string };

export function CompletionIndicator({ items }: { items: Item[] }) {
  const done = items.filter((i) => i.state === "done").length;
  const partial = items.filter((i) => i.state === "partial").length;
  const total = items.length;
  const pct = Math.round(((done + partial * 0.5) / total) * 100);

  return (
    <div className="rounded-md border border-line bg-paper p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="veein-meta">§ Your site is coming together</span>
        <span className="font-serif text-2xl">{pct}%</span>
      </div>
      <div className="h-[6px] w-full rounded-full bg-line overflow-hidden mb-4">
        <div
          className="h-full bg-ink transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-3">
            <span
              className="inline-block w-4 font-mono text-xs"
              style={{
                color:
                  item.state === "done" ? "#1D1A1A" : item.state === "partial" ? "#B89965" : "#817973"
              }}
            >
              {item.state === "done" ? "✓" : item.state === "partial" ? "◐" : "○"}
            </span>
            <span className={item.state === "todo" ? "text-ink/60" : "text-ink"}>
              {item.label}
            </span>
            {item.action ? (
              <span className="veein-meta text-stone ml-auto">{item.action}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
