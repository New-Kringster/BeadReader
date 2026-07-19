import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook, getChapter, listChapterImages } from "@/lib/data";
import ChapterEditor from "@/components/ChapterEditor";
import WebtoonChapterEditor from "@/components/WebtoonChapterEditor";
import ActionButton from "@/components/ActionButton";
import { updateChapterAction, deleteChapterAction } from "@/app/actions/chapters";
import { getR2PublicUrl, hasR2PublicBaseUrl, isR2Configured } from "@/lib/r2";

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const { bookId, chapterId } = await params;
  const [book, chapter] = await Promise.all([getBook(bookId), getChapter(chapterId)]);
  if (!book || !chapter || chapter.book_id !== bookId) notFound();
  const images = book.format === "webtoon" ? await listChapterImages(chapter.id) : [];
  const canShowArtwork = hasR2PublicBaseUrl();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/books/${bookId}`} className="text-sm text-muted hover:underline">
          ← {book.title}
        </Link>
        <ActionButton
          action={deleteChapterAction.bind(null, chapterId)}
          className="btn btn-sm btn-danger"
          confirm="Delete this chapter? This can't be undone."
        >
          Delete chapter
        </ActionButton>
      </div>
      {book.format === "webtoon" ? (
        isR2Configured() && canShowArtwork ? (
          <WebtoonChapterEditor
            action={updateChapterAction.bind(null, chapterId)}
            chapter={chapter}
            initialImages={images.map((image) => ({ ...image, url: getR2PublicUrl(image.object_key) }))}
          />
        ) : (
          <div className="card p-6">
            <h2 className="font-semibold">Webtoon storage needs configuration</h2>
            <p className="text-sm text-muted mt-2">
              Add the optional Cloudflare R2 environment variables, including a public base URL,
              then redeploy. Text books remain available without them.
            </p>
          </div>
        )
      ) : (
        <ChapterEditor action={updateChapterAction.bind(null, chapterId)} chapter={chapter} />
      )}
    </div>
  );
}
