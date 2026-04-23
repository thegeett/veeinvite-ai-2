"use client";

import { useRef, useState } from "react";

type Props = { coupleId: string; existing?: string[] };

/**
 * Photo gallery upload UI (plan §16 VI-F017). Calls POST /api/photos.
 * No image cropping in M1 — just direct upload + thumbnail preview.
 *
 * When Stream C's endpoint accepts multipart form-data, this component POSTs
 * directly. In fixture mode we construct object URLs so the UI flow is complete
 * without a round-trip.
 */
export function PhotoUpload({ coupleId, existing = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(existing);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (process.env.NODE_ENV === "development") {
          urls.push(URL.createObjectURL(file));
        } else {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("coupleId", coupleId);
          const r = await fetch("/api/photos", { method: "POST", body: fd });
          if (r.ok) {
            const data = (await r.json()) as { url: string };
            urls.push(data.url);
          }
        }
      }
      setPhotos((prev) => [...prev, ...urls]);
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
      </div>

      {photos.length > 0 ? (
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url + i}
              src={url}
              alt=""
              className="aspect-square w-full object-cover rounded-sm"
            />
          ))}
        </div>
      ) : (
        <p className="veein-meta text-stone">No photos yet. Upload at least 3 for a balanced gallery.</p>
      )}
    </div>
  );
}
