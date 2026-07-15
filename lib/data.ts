import "server-only";
import { supabaseAdmin } from "./supabase";
import { generateAccessCode } from "./codes";
import { processChapterContent, hasSpicy } from "./redact";
import {
  DEFAULT_SETTINGS,
  type Book,
  type Chapter,
  type ReaderSettings,
  type ReadingProgress,
  type Role,
  type User,
} from "./types";

// ============================================================
// Books
// ============================================================
export async function listAllBooks(): Promise<Book[]> {
  const { data } = await supabaseAdmin
    .from("books")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as Book[];
}

export async function listPublishedBooks(): Promise<Book[]> {
  const { data } = await supabaseAdmin
    .from("books")
    .select("*")
    .eq("status", "published")
    .order("title");
  return (data ?? []) as Book[];
}

export async function getBook(id: string): Promise<Book | null> {
  const { data } = await supabaseAdmin.from("books").select("*").eq("id", id).maybeSingle();
  return (data as Book) ?? null;
}

/** A published book, for readers. Drafts are invisible. */
export async function getPublishedBook(id: string): Promise<Book | null> {
  const { data } = await supabaseAdmin
    .from("books")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  return (data as Book) ?? null;
}

export async function createBook(fields: Partial<Book>): Promise<Book> {
  const { data, error } = await supabaseAdmin
    .from("books")
    .insert({
      title: fields.title ?? "Untitled",
      author: fields.author ?? null,
      description: fields.description ?? null,
      cover_url: fields.cover_url ?? null,
      status: fields.status ?? "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Book;
}

export async function updateBook(id: string, fields: Partial<Book>): Promise<void> {
  const { error } = await supabaseAdmin.from("books").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteBook(id: string): Promise<void> {
  await supabaseAdmin.from("books").delete().eq("id", id);
}

// ============================================================
// Chapters
// ============================================================
export async function listChapters(bookId: string): Promise<Chapter[]> {
  const { data } = await supabaseAdmin
    .from("chapters")
    .select("*")
    .eq("book_id", bookId)
    .order("position", { ascending: true });
  return (data ?? []) as Chapter[];
}

/** Whether this user may see spicy passages in full (vs. redacted). */
function canSeeSpicy(user: Pick<User, "role" | "has_explicit_access">): boolean {
  return user.role === "admin" || user.has_explicit_access;
}

/**
 * Reveal or redact the inline `[[spicy]]` spans in a chapter's body for this
 * reader. Runs server-side, so a reader without access never receives the
 * explicit text — only the redaction placeholder. (This is separate from the
 * whole-chapter `is_explicit` gate below.)
 */
function applyRedaction<T extends Pick<Chapter, "content">>(
  chapter: T,
  user: Pick<User, "role" | "has_explicit_access">
): T {
  return { ...chapter, content: processChapterContent(chapter.content, canSeeSpicy(user)) };
}

/** A readable chapter plus a `has_spicy` flag for the contents list. It's true
 *  when the chapter is whole-chapter explicit OR contains any inline `[[spicy]]`
 *  passage — computed from the RAW content, before redaction strips the markers. */
export type ReadableChapter = Chapter & { has_spicy: boolean };

/** Whether to flag a chapter 🌶: whole-chapter explicit or inline spicy content. */
function isSpicyChapter(raw: Chapter): boolean {
  return raw.is_explicit || hasSpicy(raw.content);
}

/**
 * The explicit-content gate. For readers we return only PUBLISHED chapters, and
 * fully-hidden ("spicy") chapters are excluded IN THE QUERY unless the user has
 * access — so a reader without access never receives them at all. Inline spicy
 * passages in the remaining chapters are redacted here, server-side.
 *
 * `has_spicy` is derived from each chapter's raw content BEFORE redaction (which
 * removes the markers), so the contents list can flag inline-spicy chapters too.
 */
export async function listReadableChapters(
  bookId: string,
  user: Pick<User, "role" | "has_explicit_access">
): Promise<ReadableChapter[]> {
  if (user.role === "admin") {
    const chapters = await listChapters(bookId);
    return chapters.map((c) => ({ ...applyRedaction(c, user), has_spicy: isSpicyChapter(c) }));
  }

  let query = supabaseAdmin
    .from("chapters")
    .select("*")
    .eq("book_id", bookId)
    .eq("status", "published")
    .order("position", { ascending: true });

  if (!user.has_explicit_access) query = query.eq("is_explicit", false);

  const { data } = await query;
  return ((data ?? []) as Chapter[]).map((c) => ({
    ...applyRedaction(c, user),
    has_spicy: isSpicyChapter(c),
  }));
}

export async function getChapter(id: string): Promise<Chapter | null> {
  const { data } = await supabaseAdmin.from("chapters").select("*").eq("id", id).maybeSingle();
  return (data as Chapter) ?? null;
}

/**
 * A single chapter a reader is allowed to open. The gate lives in the query:
 * the chapter must be published, its book must be published, and if it's gated
 * the user must have explicit access — otherwise this returns null.
 */
export async function getReadableChapter(
  chapterId: string,
  user: Pick<User, "role" | "has_explicit_access">
): Promise<Chapter | null> {
  if (user.role === "admin") {
    const chapter = await getChapter(chapterId);
    return chapter ? applyRedaction(chapter, user) : null;
  }

  let query = supabaseAdmin
    .from("chapters")
    .select("*, books!inner(status)")
    .eq("id", chapterId)
    .eq("status", "published")
    .eq("books.status", "published");

  if (!user.has_explicit_access) query = query.eq("is_explicit", false);

  const { data } = await query.maybeSingle();
  if (!data) return null;
  const { books: _book, ...rest } = data as Chapter & { books: unknown };
  return applyRedaction(rest as Chapter, user);
}

async function nextPosition(bookId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("chapters")
    .select("position")
    .eq("book_id", bookId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data.position as number) + 1 : 0;
}

export async function createChapter(bookId: string, fields: Partial<Chapter>): Promise<Chapter> {
  const { data, error } = await supabaseAdmin
    .from("chapters")
    .insert({
      book_id: bookId,
      title: fields.title ?? "Untitled chapter",
      content: fields.content ?? "",
      status: fields.status ?? "draft",
      is_explicit: fields.is_explicit ?? false,
      position: fields.position ?? (await nextPosition(bookId)),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Chapter;
}

export async function updateChapter(id: string, fields: Partial<Chapter>): Promise<void> {
  const { error } = await supabaseAdmin.from("chapters").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteChapter(id: string): Promise<void> {
  await supabaseAdmin.from("chapters").delete().eq("id", id);
}

/** Persist a new chapter order (array of chapter ids in the desired order). */
export async function reorderChapters(bookId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabaseAdmin.from("chapters").update({ position: index }).eq("id", id).eq("book_id", bookId)
    )
  );
}

// ============================================================
// Readers / users
// ============================================================
export async function getUserByAccessCode(code: string): Promise<User | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("access_code", code.trim())
    .maybeSingle();
  return (data as User) ?? null;
}

/** All users (admins first, then readers), newest first within each. */
export async function listAllUsers(): Promise<User[]> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .order("role", { ascending: true }) // 'admin' < 'reader'
    .order("created_at", { ascending: false });
  return (data ?? []) as User[];
}

/**
 * Create a user with an optional preset access code. If `code` is omitted a
 * random one is generated. Admins get explicit access by default (they see
 * everything anyway). Returns { error } on a duplicate preset code.
 */
export async function createUser(
  name: string,
  role: Role,
  code?: string
): Promise<{ user?: User; error?: string }> {
  const base = {
    name: name.trim() || (role === "admin" ? "Admin" : "Reader"),
    role,
    has_explicit_access: role === "admin",
  };

  if (code && code.trim()) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({ ...base, access_code: code.trim() })
      .select("*")
      .single();
    if (error?.code === "23505") return { error: "That access code is already taken." };
    if (error) throw error;
    return { user: data as User };
  }

  // Auto-generate; retry on the (astronomically unlikely) collision.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({ ...base, access_code: generateAccessCode() })
      .select("*")
      .single();
    if (!error) return { user: data as User };
    if (error.code !== "23505") throw error;
  }
  return { error: "Could not generate a unique access code, please try again." };
}

export async function regenerateCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateAccessCode();
    const { error } = await supabaseAdmin
      .from("users")
      .update({ access_code: code })
      .eq("id", userId);
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique access code, please try again.");
}

/** Set a specific (custom) access code for a user. Enforces uniqueness. */
export async function setCustomAccessCode(
  userId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("users")
    .update({ access_code: code.trim() })
    .eq("id", userId);
  if (error?.code === "23505") return { ok: false, error: "That code is already taken." };
  if (error) throw error;
  return { ok: true };
}

export async function setUserRevoked(userId: string, revoked: boolean): Promise<void> {
  await supabaseAdmin.from("users").update({ revoked }).eq("id", userId);
}

export async function setReaderExplicit(userId: string, hasAccess: boolean): Promise<void> {
  await supabaseAdmin
    .from("users")
    .update({ has_explicit_access: hasAccess })
    .eq("id", userId)
    .eq("role", "reader");
}

export async function deleteUser(userId: string): Promise<void> {
  await supabaseAdmin.from("users").delete().eq("id", userId);
}

/** Number of admins (used to prevent removing/revoking the last one). */
export async function countAdmins(excludeUserId?: string): Promise<number> {
  let q = supabaseAdmin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("revoked", false);
  if (excludeUserId) q = q.neq("id", excludeUserId);
  const { count } = await q;
  return count ?? 0;
}

// ============================================================
// Reader settings
// ============================================================
export async function getSettings(userId: string): Promise<ReaderSettings> {
  const { data } = await supabaseAdmin
    .from("reader_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as ReaderSettings;
  return { user_id: userId, updated_at: new Date(0).toISOString(), ...DEFAULT_SETTINGS };
}

export async function saveSettings(
  userId: string,
  settings: Partial<Omit<ReaderSettings, "user_id" | "updated_at">>
): Promise<void> {
  await supabaseAdmin
    .from("reader_settings")
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() });
}

// ============================================================
// Reading progress & time
// ============================================================
export async function getProgress(userId: string, bookId: string): Promise<ReadingProgress | null> {
  const { data } = await supabaseAdmin
    .from("reading_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();
  return (data as ReadingProgress) ?? null;
}

export async function saveProgress(
  userId: string,
  bookId: string,
  chapterId: string,
  scrollFraction: number,
  page: number
): Promise<void> {
  await supabaseAdmin.from("reading_progress").upsert({
    user_id: userId,
    book_id: bookId,
    chapter_id: chapterId,
    scroll_fraction: Math.min(1, Math.max(0, scrollFraction)),
    page: Math.max(1, Math.round(page)),
    updated_at: new Date().toISOString(),
  });
}

export async function addReadingTime(
  userId: string,
  bookId: string,
  seconds: number
): Promise<void> {
  const add = Math.max(0, Math.round(seconds));
  if (add === 0) return;
  const { data } = await supabaseAdmin
    .from("reading_time")
    .select("total_seconds")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();
  const total = (data?.total_seconds ?? 0) + add;
  await supabaseAdmin.from("reading_time").upsert({
    user_id: userId,
    book_id: bookId,
    total_seconds: total,
    updated_at: new Date().toISOString(),
  });
}

// ============================================================
// Per-chapter read tracking (which chapters a reader has opened)
// ============================================================
/** Record that a reader has opened (read) a chapter. Idempotent. */
export async function markChapterRead(
  userId: string,
  bookId: string,
  chapterId: string
): Promise<void> {
  await supabaseAdmin
    .from("chapter_reads")
    .upsert(
      { user_id: userId, chapter_id: chapterId, book_id: bookId, read_at: new Date().toISOString() },
      { onConflict: "user_id,chapter_id" }
    );
}

/** The set of chapter ids in this book that the reader has opened. */
export async function listReadChapterIds(userId: string, bookId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("chapter_reads")
    .select("chapter_id")
    .eq("user_id", userId)
    .eq("book_id", bookId);
  return (data ?? []).map((r) => r.chapter_id as string);
}

/** One person's progress through a book, for the readers-progress widget. */
export interface ReaderBookProgress {
  userId: string;
  name: string;
  isAdmin: boolean;
  readCount: number;
  total: number;
  pct: number;
  /** 1-based number of the chapter they're currently on (book order), or null. */
  currentChapterNumber: number | null;
  /** Total active seconds this person has spent reading this book. */
  totalSeconds: number;
}

/**
 * Everyone's progress through a book, for the contents-page widget. Progress is
 * chapters-opened / total published chapters. Only people who have actually
 * started the book are returned, ordered furthest-along first.
 */
export async function getBookReadersProgress(
  bookId: string
): Promise<ReaderBookProgress[]> {
  const { data: chData } = await supabaseAdmin
    .from("chapters")
    .select("id")
    .eq("book_id", bookId)
    .eq("status", "published")
    .order("position", { ascending: true });
  const chapters = (chData ?? []) as { id: string }[];
  const total = chapters.length;
  if (total === 0) return [];

  // 1-based chapter number in book order.
  const numberById = new Map(chapters.map((c, i) => [c.id, i + 1]));

  const [{ data: users }, { data: reads }, { data: progress }, { data: times }] =
    await Promise.all([
      supabaseAdmin.from("users").select("id, name, role").eq("revoked", false),
      supabaseAdmin.from("chapter_reads").select("user_id, chapter_id").eq("book_id", bookId),
      supabaseAdmin
        .from("reading_progress")
        .select("user_id, chapter_id, updated_at")
        .eq("book_id", bookId),
      supabaseAdmin.from("reading_time").select("user_id, total_seconds").eq("book_id", bookId),
    ]);

  const readsByUser = new Map<string, Set<string>>();
  for (const r of reads ?? []) {
    if (!numberById.has(r.chapter_id as string)) continue;
    const set = readsByUser.get(r.user_id as string) ?? new Set<string>();
    set.add(r.chapter_id as string);
    readsByUser.set(r.user_id as string, set);
  }
  const progByUser = new Map(
    (progress ?? []).map((p) => [p.user_id as string, p as { chapter_id: string | null; updated_at: string }])
  );
  const secondsByUser = new Map(
    (times ?? []).map((t) => [t.user_id as string, (t.total_seconds as number) ?? 0])
  );

  const rows: ReaderBookProgress[] = [];
  for (const u of (users ?? []) as { id: string; name: string; role: Role }[]) {
    const readCount = readsByUser.get(u.id)?.size ?? 0;
    const prog = progByUser.get(u.id);
    if (readCount === 0 && !prog) continue; // hasn't started this book

    const curId = prog?.chapter_id ?? null;
    rows.push({
      userId: u.id,
      name: u.name,
      isAdmin: u.role === "admin",
      readCount,
      total,
      pct: Math.min(100, Math.round((readCount / total) * 100)),
      currentChapterNumber: curId ? numberById.get(curId) ?? null : null,
      totalSeconds: secondsByUser.get(u.id) ?? 0,
    });
  }

  rows.sort((a, b) => b.pct - a.pct || b.totalSeconds - a.totalSeconds);
  return rows;
}

/** Clear a single chapter's read mark for this reader (undo). */
export async function unmarkChapterRead(userId: string, chapterId: string): Promise<void> {
  await supabaseAdmin
    .from("chapter_reads")
    .delete()
    .eq("user_id", userId)
    .eq("chapter_id", chapterId);
}

export async function getReadingTime(userId: string, bookId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("reading_time")
    .select("total_seconds")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();
  return data?.total_seconds ?? 0;
}

/**
 * Which chapter to open when a reader taps a book (auto-resume). Returns the
 * last-read chapter if it's still readable, else the first readable chapter,
 * else null (nothing the reader may see). Only ever considers gated chapters.
 */
export async function resolveResumeChapter(
  user: Pick<User, "role" | "has_explicit_access">,
  bookId: string,
  userId: string
): Promise<{ chapterId: string; title: string; resuming: boolean } | null> {
  const chapters = await listReadableChapters(bookId, user);
  if (chapters.length === 0) return null;

  const progress = await getProgress(userId, bookId);
  const last =
    progress?.chapter_id && chapters.find((c) => c.id === progress.chapter_id);
  const target = last || chapters[0];
  return { chapterId: target.id, title: target.title, resuming: Boolean(last) };
}

// ============================================================
// Comments
// ============================================================
export interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_is_admin: boolean;
}

export async function listComments(chapterId: string): Promise<CommentRow[]> {
  const { data } = await supabaseAdmin
    .from("comments")
    .select("id, body, created_at, user_id, users(name, role)")
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((c) => {
    const u = c.users as { name?: string; role?: string } | null;
    return {
      id: c.id as string,
      body: c.body as string,
      created_at: c.created_at as string,
      user_id: c.user_id as string,
      author_name: u?.name ?? "Someone",
      author_is_admin: u?.role === "admin",
    };
  });
}

/** A comment plus the chapter it belongs to, for the book-wide comments feed. */
export interface BookCommentRow extends CommentRow {
  chapter_id: string;
  chapter_title: string;
  /** 1-based position of the chapter within this reader's contents list. */
  chapter_number: number;
}

/**
 * All comments across a book, newest first, each tagged with its chapter. Only
 * comments on chapters this reader may actually see are returned — chapters
 * hidden by the explicit-content gate are excluded, so their comments never
 * leak into the feed.
 */
export async function listBookComments(
  bookId: string,
  user: Pick<User, "role" | "has_explicit_access">
): Promise<BookCommentRow[]> {
  const chapters = await listReadableChapters(bookId, user);
  if (chapters.length === 0) return [];

  // Number chapters by their position in the reader's contents list (matching
  // the numbers shown there), not the raw DB position field.
  const meta = new Map(
    chapters.map((c, i) => [c.id, { title: c.title, number: i + 1 }])
  );

  const { data } = await supabaseAdmin
    .from("comments")
    .select("id, body, created_at, user_id, chapter_id, users(name, role)")
    .in("chapter_id", Array.from(meta.keys()))
    .order("created_at", { ascending: false });

  return (data ?? []).map((c) => {
    const u = c.users as { name?: string; role?: string } | null;
    const ch = meta.get(c.chapter_id as string);
    return {
      id: c.id as string,
      body: c.body as string,
      created_at: c.created_at as string,
      user_id: c.user_id as string,
      author_name: u?.name ?? "Someone",
      author_is_admin: u?.role === "admin",
      chapter_id: c.chapter_id as string,
      chapter_title: ch?.title ?? "—",
      chapter_number: ch?.number ?? 0,
    };
  });
}

export async function addComment(
  userId: string,
  chapterId: string,
  body: string
): Promise<CommentRow> {
  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({ user_id: userId, chapter_id: chapterId, body })
    .select("id, body, created_at, user_id, users(name, role)")
    .single();
  if (error) throw error;
  const u = data.users as { name?: string; role?: string } | null;
  return {
    id: data.id as string,
    body: data.body as string,
    created_at: data.created_at as string,
    user_id: data.user_id as string,
    author_name: u?.name ?? "Someone",
    author_is_admin: u?.role === "admin",
  };
}

/** Deletes a comment if the requester owns it or is an admin. */
export async function deleteComment(commentId: string, user: User): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("comments")
    .select("user_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!data) return false;
  if (user.role !== "admin" && data.user_id !== user.id) return false;
  await supabaseAdmin.from("comments").delete().eq("id", commentId);
  return true;
}

/** For the admin per-reader view: where each reader is + total time, per book. */
export async function getReaderActivity(userId: string) {
  const [{ data: progress }, { data: time }] = await Promise.all([
    supabaseAdmin
      .from("reading_progress")
      .select("book_id, chapter_id, updated_at, books(title), chapters(title)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabaseAdmin.from("reading_time").select("book_id, total_seconds").eq("user_id", userId),
  ]);
  const timeByBook = new Map<string, number>();
  for (const row of time ?? []) timeByBook.set(row.book_id, row.total_seconds);
  return (progress ?? []).map((p) => ({
    bookId: p.book_id as string,
    bookTitle: (p.books as { title?: string } | null)?.title ?? "—",
    chapterTitle: (p.chapters as { title?: string } | null)?.title ?? "—",
    updatedAt: p.updated_at as string,
    totalSeconds: timeByBook.get(p.book_id as string) ?? 0,
  }));
}
