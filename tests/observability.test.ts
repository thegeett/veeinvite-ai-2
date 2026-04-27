// F1 — observability helper tests.
//
// `emitEvent(name, fields)` produces a single structured-log line via
// console.log so downstream pipelines (and grep) can pick out events without
// needing a service. Format is one JSON object per line with `event`, `ts`,
// and the caller's fields merged in.
//
// Tests run before the helper exists; they will fail until F1 is implemented.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitEvent } from "@/lib/observability/events";

describe("emitEvent", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("emits a single console.log line", () => {
    emitEvent("palette_precall", { attempt: 1, status: "ok", culture: "hindu_indian" });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("emits a JSON object with event name + provided fields", () => {
    emitEvent("palette_precall", { attempt: 2, status: "retry", culture: "western" });
    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe("palette_precall");
    expect(parsed.attempt).toBe(2);
    expect(parsed.status).toBe("retry");
    expect(parsed.culture).toBe("western");
  });

  it("includes an ISO-8601 timestamp", () => {
    emitEvent("palette_precall", { attempt: 1, status: "ok", culture: "muslim" });
    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("does not crash on undefined / null field values", () => {
    expect(() =>
      emitEvent("palette_precall", { attempt: 1, status: "fallback", culture: "western", error: undefined })
    ).not.toThrow();
  });
});
