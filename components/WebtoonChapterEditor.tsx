"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import SubmitButton from "@/components/SubmitButton";
import {
  naturalSortFiles,
  prepareWebtoonImage,
  uploadWithProgress,
  WEBTOON_RECOMMENDED_HEIGHT,
  WEBTOON_TARGET_WIDTH,
} from "@/lib/webtoon-client";
import type { Chapter, ChapterImage } from "@/lib/types";

type StoredImage = ChapterImage & { url: string };
type QueuedImage = {
  clientId: string;
  originalFilename: string;
  file: File;
  width: number;
  height: number;
  previewUrl: string;
  progress: number;
  status: "ready" | "uploading" | "failed";
  error?: string;
};

async function responseJSON<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed with HTTP ${response.status}.`);
  return body;
}

export default function WebtoonChapterEditor({
  action,
  chapter,
  initialImages,
}: {
  action: (formData: FormData) => Promise<void>;
  chapter: Chapter;
  initialImages: StoredImage[];
}) {
  const [title, setTitle] = useState(chapter.title);
  const [status, setStatus] = useState(chapter.status);
  const [spicy, setSpicy] = useState(chapter.is_explicit);
  const [images, setImages] = useState(initialImages);
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isMutating, startMutation] = useTransition();
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  async function chooseFiles(selected: FileList | null) {
    if (!selected?.length) return;
    setNotice(null);
    setIsPreparing(true);
    const next: QueuedImage[] = [];
    const failures: string[] = [];
    for (const original of naturalSortFiles(Array.from(selected))) {
      try {
        const prepared = await prepareWebtoonImage(original);
        next.push({
          clientId: crypto.randomUUID(),
          originalFilename: original.name,
          file: prepared.file,
          width: prepared.width,
          height: prepared.height,
          previewUrl: URL.createObjectURL(prepared.file),
          progress: 0,
          status: "ready",
        });
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `Could not prepare ${original.name}.`);
      }
    }
    setQueue((current) => [...current, ...next]);
    if (failures.length) setNotice(failures.join(" "));
    setIsPreparing(false);
    if (folderRef.current) folderRef.current.value = "";
    if (filesRef.current) filesRef.current.value = "";
  }

  function updateQueued(clientId: string, patch: Partial<QueuedImage>) {
    setQueue((current) =>
      current.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item))
    );
  }

  async function uploadQueued() {
    const pending = queue.filter((item) => item.status !== "uploading");
    if (!pending.length) return;
    setNotice(null);
    try {
      const signed = await responseJSON<{
        uploads: Array<{ clientId: string; objectKey: string; uploadUrl: string }>;
      }>(
        await fetch("/api/admin/webtoon/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chapterId: chapter.id,
            files: pending.map((item) => ({
              clientId: item.clientId,
              name: item.file.name,
              type: item.file.type,
              size: item.file.size,
              width: item.width,
              height: item.height,
            })),
          }),
        })
      );

      const descriptors = new Map(signed.uploads.map((item) => [item.clientId, item]));
      const completed: Array<QueuedImage & { objectKey: string }> = [];
      let cursor = 0;
      async function worker() {
        while (cursor < pending.length) {
          const item = pending[cursor++];
          const descriptor = descriptors.get(item.clientId);
          if (!descriptor) continue;
          updateQueued(item.clientId, { status: "uploading", progress: 0, error: undefined });
          try {
            await uploadWithProgress(descriptor.uploadUrl, item.file, (progress) =>
              updateQueued(item.clientId, { progress })
            );
            completed.push({ ...item, objectKey: descriptor.objectKey });
          } catch (error) {
            updateQueued(item.clientId, {
              status: "failed",
              error: error instanceof Error ? error.message : "Upload failed.",
            });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, pending.length) }, () => worker()));

      // Restore the original natural order after concurrent workers complete.
      completed.sort((a, b) => pending.findIndex((x) => x.clientId === a.clientId) - pending.findIndex((x) => x.clientId === b.clientId));
      if (completed.length) {
        const saved = await responseJSON<{ images: StoredImage[] }>(
          await fetch("/api/admin/webtoon/images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chapterId: chapter.id,
              uploads: completed.map((item) => ({
                objectKey: item.objectKey,
                originalFilename: item.originalFilename,
                mimeType: item.file.type,
                width: item.width,
                height: item.height,
              })),
            }),
          })
        );
        const completedIds = new Set(completed.map((item) => item.clientId));
        completed.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        setQueue((current) => current.filter((item) => !completedIds.has(item.clientId)));
        setImages((current) => [...current, ...saved.images]);
      }
      const failedCount = pending.length - completed.length;
      setNotice(
        failedCount
          ? `${completed.length} image${completed.length === 1 ? "" : "s"} saved; ${failedCount} failed and can be retried.`
          : `${completed.length} image${completed.length === 1 ? "" : "s"} uploaded in order.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not upload images.");
      setQueue((current) =>
        current.map((item) =>
          item.status === "uploading" ? { ...item, status: "failed", error: "Upload interrupted." } : item
        )
      );
    }
  }

  function removeQueued(clientId: string) {
    setQueue((current) => {
      const item = current.find((candidate) => candidate.clientId === clientId);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((candidate) => candidate.clientId !== clientId);
    });
  }

  function moveStored(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const previous = images;
    const reordered = [...images];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setImages(reordered);
    startMutation(async () => {
      try {
        await responseJSON(
          await fetch("/api/admin/webtoon/images", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chapterId: chapter.id, orderedIds: reordered.map((item) => item.id) }),
          })
        );
      } catch (error) {
        setImages(previous);
        setNotice(error instanceof Error ? error.message : "Could not reorder images.");
      }
    });
  }

  function removeStored(image: StoredImage) {
    if (!window.confirm(`Delete ${image.original_filename}? This also removes it from R2.`)) return;
    const previous = images;
    setImages((current) => current.filter((item) => item.id !== image.id));
    startMutation(async () => {
      try {
        await responseJSON(
          await fetch("/api/admin/webtoon/images", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageId: image.id }),
          })
        );
      } catch (error) {
        setImages(previous);
        setNotice(error instanceof Error ? error.message : "Could not delete image.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input
          name="title"
          className="field text-lg font-semibold"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <div className="card px-4 py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Status:</span>
            {(["draft", "published"] as const).map((value) => (
              <label key={value} className="flex items-center gap-1 cursor-pointer capitalize">
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={status === value}
                  onChange={() => setStatus(value)}
                />
                {value}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="is_explicit"
              checked={spicy}
              onChange={(event) => setSpicy(event.target.checked)}
            />
            🌶 Hide entire chapter without explicit access
          </label>
          <div className="ml-auto">
            <SubmitButton>Save chapter</SubmitButton>
          </div>
        </div>
      </form>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-lg">Chapter artwork</h2>
          <p className="text-sm text-muted mt-1">
            Recommended: {WEBTOON_TARGET_WIDTH}×{WEBTOON_RECOMMENDED_HEIGHT}px portrait images,
            named 001, 002, 003… Dialogue should already be baked into the artwork. Wider images
            are resized to {WEBTOON_TARGET_WIDTH}px and converted to WebP before upload.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => folderRef.current?.click()} disabled={isPreparing}>
            {isPreparing ? "Preparing…" : "Choose image folder"}
          </button>
          <button type="button" className="btn" onClick={() => filesRef.current?.click()} disabled={isPreparing}>
            Choose multiple images
          </button>
          <input
            ref={folderRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => void chooseFiles(event.target.files)}
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          <input
            ref={filesRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => void chooseFiles(event.target.files)}
          />
        </div>

        {notice && <p className="text-sm rounded-lg bg-line/40 p-3" role="status">{notice}</p>}

        {queue.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Ready to upload ({queue.length})</h3>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void uploadQueued()} disabled={queue.some((item) => item.status === "uploading")}>
                Upload in this order
              </button>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {queue.map((item, index) => (
                <li key={item.clientId} className="border border-line rounded-lg overflow-hidden bg-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt={`Queued image ${index + 1}`} className="block w-full aspect-[9/16] object-cover object-top" />
                  <div className="p-3 text-xs space-y-2">
                    <div className="font-semibold truncate">{index + 1}. {item.originalFilename}</div>
                    <div className="text-muted">{item.width}×{item.height} · {(item.file.size / 1024 / 1024).toFixed(1)} MB</div>
                    {item.status === "uploading" && (
                      <div className="h-1.5 bg-line rounded overflow-hidden"><div className="h-full bg-accent" style={{ width: `${item.progress}%` }} /></div>
                    )}
                    {item.error && <p className="text-danger">{item.error}</p>}
                    <button type="button" className="btn btn-sm btn-danger" disabled={item.status === "uploading"} onClick={() => removeQueued(item.clientId)}>Remove</button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Saved images ({images.length})</h3>
            {images.length > 0 && (
              <Link
                href={`/admin/books/${chapter.book_id}/chapters/${chapter.id}/preview`}
                className="btn btn-sm"
              >
                Preview chapter →
              </Link>
            )}
          </div>
          {images.length === 0 ? (
            <p className="text-sm text-muted py-5">No images yet. This chapter must have at least one before it can be published.</p>
          ) : (
            <ol className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${isMutating ? "opacity-70" : ""}`}>
              {images.map((image, index) => (
                <li key={image.id} className="border border-line rounded-lg overflow-hidden bg-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={`Chapter image ${index + 1}`} className="block w-full aspect-[9/16] object-cover object-top" />
                  <div className="p-3 space-y-2 text-xs">
                    <div className="font-semibold truncate">{index + 1}. {image.original_filename}</div>
                    <div className="text-muted">{image.width}×{image.height} · {(image.byte_size / 1024 / 1024).toFixed(1)} MB</div>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="btn btn-sm" disabled={index === 0 || isMutating} onClick={() => moveStored(index, -1)}>↑</button>
                      <button type="button" className="btn btn-sm" disabled={index === images.length - 1 || isMutating} onClick={() => moveStored(index, 1)}>↓</button>
                      <button type="button" className="btn btn-sm btn-danger ml-auto" disabled={isMutating} onClick={() => removeStored(image)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
