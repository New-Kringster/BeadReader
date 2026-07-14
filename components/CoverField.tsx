"use client";
import { useRef, useState } from "react";

/**
 * Cover-image picker that downscales the selected image in the browser before it
 * is submitted, so a large phone photo becomes a small JPEG. This keeps uploads
 * well under the Server Action body limit and saves storage/bandwidth. Falls back
 * to the original file if anything goes wrong.
 */
async function downscale(file: File, maxDim = 1400, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality)
    );
    if (!blob) return file;
    // If the "compressed" version somehow got bigger (e.g. tiny source), keep original.
    if (blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "cover";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function CoverField({ currentUrl }: { currentUrl?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const optimized = await downscale(file);
      // Replace the input's file with the optimized one so the form submits it.
      const dt = new DataTransfer();
      dt.items.add(optimized);
      if (inputRef.current) inputRef.current.files = dt.files;
      setPreview(URL.createObjectURL(optimized));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor="cover" className="label">
        Cover image {currentUrl ? "(leave empty to keep current)" : "(optional)"}
      </label>
      {preview && (
        <div className="mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Cover preview"
            className="w-24 h-32 object-cover rounded border border-line"
          />
        </div>
      )}
      <input
        ref={inputRef}
        id="cover"
        name="cover"
        type="file"
        accept="image/*"
        className="field"
        onChange={onChange}
      />
      <p className="text-xs text-muted mt-1">
        {busy ? "Optimizing image…" : "Large images are automatically resized before upload."}
      </p>
    </div>
  );
}
