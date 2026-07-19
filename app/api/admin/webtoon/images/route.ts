import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  addChapterImages,
  deleteChapterImage,
  getBook,
  getChapter,
  getChapterImage,
  listChapterImages,
  reorderChapterImages,
} from "@/lib/data";
import {
  deleteR2Objects,
  getR2PublicUrl,
  verifyR2Object,
  webtoonObjectPrefix,
} from "@/lib/r2";
import type { ChapterImage } from "@/lib/types";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 25 * 1024 * 1024;

type CompletedUpload = {
  objectKey: string;
  originalFilename: string;
  mimeType: ChapterImage["mime_type"];
  width: number;
  height: number;
};

function present(image: ChapterImage) {
  return { ...image, url: getR2PublicUrl(image.object_key) };
}

async function requireApiAdmin() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return null;
}

async function webtoonChapter(chapterId: string) {
  const chapter = await getChapter(chapterId);
  const book = chapter ? await getBook(chapter.book_id) : null;
  if (!chapter || !book || book.format !== "webtoon") return null;
  return { chapter, book };
}

export async function POST(request: Request) {
  const authError = await requireApiAdmin();
  if (authError) return authError;

  const storedKeys: string[] = [];
  try {
    const body = (await request.json()) as { chapterId?: string; uploads?: CompletedUpload[] };
    const chapterId = body.chapterId ?? "";
    const uploads = body.uploads ?? [];
    const target = await webtoonChapter(chapterId);
    if (!target) return NextResponse.json({ error: "That is not a webtoon chapter." }, { status: 404 });
    if (uploads.length === 0 || uploads.length > 200) {
      return NextResponse.json({ error: "No completed uploads were supplied." }, { status: 400 });
    }

    const prefix = webtoonObjectPrefix(target.book.id, target.chapter.id);
    for (const upload of uploads) {
      if (
        !upload.objectKey.startsWith(prefix) ||
        !upload.originalFilename ||
        !ALLOWED_TYPES.has(upload.mimeType) ||
        !Number.isInteger(upload.width) ||
        upload.width <= 0 ||
        !Number.isInteger(upload.height) ||
        upload.height <= 0
      ) {
        return NextResponse.json({ error: "Invalid completed upload metadata." }, { status: 400 });
      }
    }

    // From this point onward these are legitimate objects created for this
    // chapter. If verification or the metadata insert fails, remove all of them
    // so a partially completed batch does not become an R2 orphan.
    storedKeys.push(...uploads.map((upload) => upload.objectKey));
    const verified = [];
    for (const upload of uploads) {
      const object = await verifyR2Object(upload.objectKey);
      if (
        object.contentType !== upload.mimeType ||
        object.byteSize <= 0 ||
        object.byteSize > MAX_BYTES
      ) {
        throw new Error(`R2 verification failed for ${upload.originalFilename}.`);
      }
      verified.push({
        object_key: upload.objectKey,
        original_filename: upload.originalFilename,
        mime_type: upload.mimeType,
        width: upload.width,
        height: upload.height,
        byte_size: object.byteSize,
      });
    }

    const images = await addChapterImages(chapterId, verified);
    return NextResponse.json({ images: images.map(present) });
  } catch (error) {
    if (storedKeys.length) await deleteR2Objects(storedKeys).catch(() => {});
    const message = error instanceof Error ? error.message : "Could not save uploaded images.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authError = await requireApiAdmin();
  if (authError) return authError;
  try {
    const body = (await request.json()) as { chapterId?: string; orderedIds?: string[] };
    const chapterId = body.chapterId ?? "";
    if (!(await webtoonChapter(chapterId))) {
      return NextResponse.json({ error: "That is not a webtoon chapter." }, { status: 404 });
    }
    await reorderChapterImages(chapterId, body.orderedIds ?? []);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reorder images.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireApiAdmin();
  if (authError) return authError;
  try {
    const body = (await request.json()) as { imageId?: string };
    const image = body.imageId ? await getChapterImage(body.imageId) : null;
    if (!image || !(await webtoonChapter(image.chapter_id))) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
    await deleteR2Objects([image.object_key]);
    await deleteChapterImage(image.id);
    const remaining = await listChapterImages(image.chapter_id);
    await reorderChapterImages(image.chapter_id, remaining.map((item) => item.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
