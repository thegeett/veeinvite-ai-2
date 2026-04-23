"use client";

import { useEffect, useRef, useState } from "react";

type Props = { coupleId: string; existing?: string[] };

/**
 * Photo gallery upload UI (plan §16 VI-F017).
 *
 * Per DECISIONS [2026-10], /api/photos stores and returns *storage paths*,
 * never signed URLs. Paths live forever; signed URLs expire. So the component
 * keeps the canonical list as paths and resolves each path to a short-lived
 * signed URL via GET /api/photos/sign?path=... for the thumbnail preview only.
 */
export function PhotoUpload({ coupleId, existing = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[]>(existing);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve each path → signed URL for the thumbnail grid.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = paths.filter((p) => !urls[p]);
      if (missing.length === 0) return;
      const next: Record<string, string> = {};
      for (const p of missing) {
        const r = await fetch(`/api/photos/sign?path=${encodeURIComponent(p)}`);
        if (r.ok) {
          const data = (await r.json()) as { url: string };
          next[p] = data.url;
        }
      }
      if (!cancelled) setUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [paths, urls]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("couple_id", coupleId);
      for (const file of Array.from(files)) {
        fd.append("files", file);
      }
      const r = await fetch("/api/photos", { method: "POST", body: fd });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Upload failed (${r.status})`);
      }
      const data = (await r.json()) as { photo_paths: string[] };
      setPaths((prev) => [...prev, ...(data.photo_paths ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="veein-meta mb-2 text-stone">§ Your photos</div>
        <p className="text-sm text-ink/70 max-w-md">
          The gallery cells on your site replace with your photos as you upload. No editing
          — just upload what you love.
        </p>
      </div>

      <div
        className="rounded-md border-2 border-dashed border-line bg-paper p-8 text-center"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <p className="font-serif text-xl mb-2">Drop photos here</p>
        <p className="veein-meta text-stone mb-4">or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-canvas"
        >
          Choose from your device
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {uploading ? (
          <p className="veein-meta text-blush mt-4">• uploading…</p>
        ) : null}
        {error ? (
          <p className="text-sm text-blush mt-4">{error}</p>
        ) : null}
      </div>

      {paths.length > 0 ? (
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
          {paths.map((path) => {
            const url = urls[path];
            return url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={path}
                src={url}
                alt=""
                className="aspect-square w-full object-cover rounded-sm"
              />
            ) : (
              <div
                key={path}
                className="aspect-square w-full rounded-sm bg-line/60"
                aria-hidden
              />
            );
          })}
        </div>
      ) : (
        <p className="veein-meta text-stone">No photos yet. Upload at least 3 for a balanced gallery.</p>
      )}
    </div>
  );
}
