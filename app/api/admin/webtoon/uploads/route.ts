import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createR2UploadUrl, createWebtoonObjectKey } from "@/lib/r2";
import { getBook, getChapter } from "@/lib/data";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILES_PER_BATCH = 200;
const MAX_BYTES = 25 * 1024 * 1024;

type UploadRequestFile = {
  clientId: string;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
};

async function requireApiAdmin() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  const authError = await requireApiAdmin();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { chapterId?: string; files?: UploadRequestFile[] };
    const chapterId = body.chapterId ?? "";
    const files = body.files ?? [];
    if (!chapterId || files.length === 0 || files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json({ error: "Choose between 1 and 200 images." }, { status: 400 });
    }

    const chapter = await getChapter(chapterId);
    const book = chapter ? await getBook(chapter.book_id) : null;
    if (!chapter || !book || book.format !== "webtoon") {
      return NextResponse.json({ error: "That is not a webtoon chapter." }, { status: 404 });
    }

    for (const file of files) {
      if (
        !file.clientId ||
        !file.name ||
        !ALLOWED_TYPES.has(file.type) ||
        !Number.isFinite(file.size) ||
        file.size <= 0 ||
        file.size > MAX_BYTES ||
        !Number.isInteger(file.width) ||
        file.width <= 0 ||
        !Number.isInteger(file.height) ||
        file.height <= 0
      ) {
        return NextResponse.json({ error: `Invalid image metadata for ${file.name || "an image"}.` }, { status: 400 });
      }
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        const objectKey = createWebtoonObjectKey(book.id, chapter.id, file.type);
        return {
          clientId: file.clientId,
          objectKey,
          uploadUrl: await createR2UploadUrl(objectKey, file.type),
        };
      })
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare uploads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
