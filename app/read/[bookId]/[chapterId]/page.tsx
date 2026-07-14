import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getPublishedBook,
  listReadableChapters,
  getSettings,
  getProgress,
} from "@/lib/data";
import ReaderView from "@/components/ReaderView";

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ bookId: string; chapterId: string }>;
}) {
  const { bookId, chapterId } = await params;
  const user = (await getCurrentUser())!;

  const book = await getPublishedBook(bookId);
  if (!book) notFound();

  // The gate: this list already excludes drafts and (for readers without access)
  // gated chapters. If the requested chapter isn't in it, it 404s — a reader
  // can't reach gated content even by guessing the URL.
  const chapters = await listReadableChapters(bookId, user);
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index === -1) notFound();

  const current = chapters[index];
  const prev = index > 0 ? chapters[index - 1] : null;
  const next = index < chapters.length - 1 ? chapters[index + 1] : null;

  const [settings, progress] = await Promise.all([
    getSettings(user.id),
    getProgress(user.id, bookId),
  ]);

  const isThisChapter = progress?.chapter_id === chapterId;

  return (
    <ReaderView
      bookId={bookId}
      bookTitle={book.title}
      chapter={{ id: current.id, title: current.title, content: current.content }}
      prev={prev ? { id: prev.id, title: prev.title } : null}
      next={next ? { id: next.id, title: next.title } : null}
      index={index + 1}
      total={chapters.length}
      toc={chapters.map((c) => ({ id: c.id, title: c.title, spicy: c.has_spicy }))}
      initialSettings={{
        bg_color: settings.bg_color,
        text_color: settings.text_color,
        font_size: settings.font_size,
        layout: settings.layout,
      }}
      initialScrollFraction={isThisChapter ? Number(progress?.scroll_fraction ?? 0) : 0}
      initialPage={isThisChapter ? progress?.page ?? 1 : 1}
      currentUserId={user.id}
      isAdmin={user.role === "admin"}
    />
  );
}
