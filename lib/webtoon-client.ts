"use client";

export const WEBTOON_TARGET_WIDTH = 1080;
export const WEBTOON_RECOMMENDED_HEIGHT = 1920;

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function naturalSortFiles<T extends Pick<File, "name">>(files: T[]): T[] {
  return [...files].sort((a, b) => naturalCollator.compare(a.name, b.name));
}

export async function prepareWebtoonImage(file: File): Promise<{
  file: File;
  width: number;
  height: number;
}> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} is larger than 50 MB.`);

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, WEBTOON_TARGET_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error(`Could not prepare ${file.name}.`);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9)
  );
  if (!blob) throw new Error(`Could not compress ${file.name}.`);
  if (blob.size > 25 * 1024 * 1024) {
    throw new Error(`${file.name} is still larger than 25 MB after optimization.`);
  }

  const stem = file.name.replace(/\.[^.]+$/, "") || "panel";
  return {
    file: new File([blob], `${stem}.webp`, { type: "image/webp", lastModified: file.lastModified }),
    width,
    height,
  };
}

export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`R2 returned HTTP ${request.status}.`));
    });
    request.addEventListener("error", () =>
      reject(new Error("Upload failed. Check the R2 bucket CORS settings and try again."))
    );
    request.send(file);
  });
}
