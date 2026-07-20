"use client";
import { useRef, useState, useTransition } from "react";
import { setAvatarAction, removeAvatarAction } from "@/app/actions/account";

// Compress the picked image to a small centre-cropped square in the browser, so
// what we store (and send on every presence poll) is only a few KB. JPEG for
// broad, reliable encode support.
const SIZE = 256;
const QUALITY = 0.82;

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

async function compressToDataUri(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return null;
  }
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

export default function AvatarUpload({
  name,
  initialAvatar,
}: {
  name: string;
  initialAvatar: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    let dataUri: string | null = null;
    try {
      dataUri = await compressToDataUri(file);
    } catch {
      /* handled below */
    }
    if (!dataUri) {
      setError("Couldn't process that image.");
      return;
    }
    const uri = dataUri;
    start(async () => {
      const res = await setAvatarAction(uri);
      if (res.error) setError(res.error);
      else setAvatarUrl(uri);
    });
  };

  const remove = () => {
    setError(null);
    start(async () => {
      await removeAvatarAction();
      setAvatarUrl(null);
    });
  };

  return (
    <div>
      <div className="label">Profile photo</div>
      <div className="flex items-center gap-4">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-xl font-semibold text-accent">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial(name)
          )}
        </span>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? "Saving…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            {avatarUrl && (
              <button type="button" className="btn btn-sm" disabled={pending} onClick={remove}>
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Automatically cropped to a square and compressed to a small image.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
