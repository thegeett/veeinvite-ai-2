// Tiny structured-log helper.
//
// One JSON object per line via console.log. Downstream pipelines (Vercel
// logs, log-collectors) can grep by `event=...` and parse the rest. Keeps
// the surface small — no service, no dependency. Replaceable later with a
// real sink (Datadog / Sentry / Logflare) by re-pointing this one function.
//
// Convention: every event line is a JSON object containing at least
// `event` (the name) and `ts` (ISO-8601 timestamp). Caller fields are
// merged in at the top level.

export type EventFields = Record<string, unknown>;

export function emitEvent(name: string, fields: EventFields = {}): void {
  const payload: Record<string, unknown> = {
    event: name,
    ts: new Date().toISOString(),
    ...fields
  };
  console.log(JSON.stringify(payload));
}
