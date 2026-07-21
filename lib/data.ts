import "server-only";
import { supabaseAdmin } from "./supabase";
import { generateAccessCode } from "./codes";
import { processChapterContent, hasSpicy, type SpicyView } from "./redact";
import {
  DEFAULT_SETTINGS,
  type Book,
  type Chapter,
  type ChapterImage,
  type IncomingNudge,
  type NudgeKind,
  type PresenceEntry,
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
      format: fields.format ?? "text",
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
  const { error } = await supabaseAdmin.from("books").delete().eq("id", id);
  if (error) throw error;
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

/** What the user carries that determines their spicy view. */
type SpicyUser = Pick<User, "role" | "has_explicit_access" | "cal_mode">;

/**
 * Which view of the spicy spans this reader gets:
 *  - admins & explicit-access readers → `full` (reveal on demand)
 *  - "cal mode" readers → `clean` (spicy content removed entirely)
 *  - everyone else → `preview` (a short, unopenable teaser)
 * Cal mode wins over explicit access, though they're kept mutually exclusive when
 * set (see the admin actions).
 */
function spicyViewFor(user: SpicyUser): SpicyView {
  if (user.role === "admin") return "full";
  if (user.cal_mode) return "clean";
  if (user.has_explicit_access) return "full";
  return "preview";
}

/**
 * Whether this reader may receive whole-chapter explicit content (the hard
 * `is_explicit` gate). Cal-mode readers never do, even in the (defensive) case
 * where both flags are somehow set — so a hidden spicy chapter can't leak to them.
 */
function canSeeGatedChapters(user: SpicyUser): boolean {
  return user.role === "admin" || (user.has_explicit_access && !user.cal_mode);
}

/**
 * Process the inline `[[spicy]]` spans in a chapter's body for this reader. Runs
 * server-side, so the full explicit text never reaches a reader without access —
 * they get at most a short preview excerpt, or nothing at all in cal mode. (This
 * is separate from the whole-chapter `is_explicit` gate below.)
 */
function applyRedaction<T extends Pick<Chapter, "content">>(
  chapter: T,
  view: SpicyView
): T {
  return { ...chapter, content: processChapterContent(chapter.content, view) };
}

/** A readable chapter plus a `has_spicy` flag for the contents list. It's true
 *  when the chapter is whole-chapter explicit OR contains any inline `[[spicy]]`
 *  passage — computed from the RAW content, before processing strips the markers.
 *  Always false for cal-mode readers, so no 🌶 markers show for them. */
export type ReadableChapter = Chapter & { has_spicy: boolean };

/** Whether to flag a chapter 🌶 for this reader: whole-chapter explicit or inline
 *  spicy content — but never for cal-mode readers, who see no spicy indicators. */
function isSpicyChapter(raw: Chapter, view: SpicyView): boolean {
  if (view === "clean") return false;
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
  user: SpicyUser
): Promise<ReadableChapter[]> {
  const view = spicyViewFor(user);

  if (user.role === "admin") {
    const chapters = await listChapters(bookId);
    return chapters.map((c) => ({ ...applyRedaction(c, view), has_spicy: isSpicyChapter(c, view) }));
  }

  let query = supabaseAdmin
    .from("chapters")
    .select("*")
    .eq("book_id", bookId)
    .eq("status", "published")
    .order("position", { ascending: true });

  if (!canSeeGatedChapters(user)) query = query.eq("is_explicit", false);

  const { data } = await query;
  return ((data ?? []) as Chapter[]).map((c) => ({
    ...applyRedaction(c, view),
    has_spicy: isSpicyChapter(c, view),
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
  user: SpicyUser
): Promise<Chapter | null> {
  const view = spicyViewFor(user);

  if (user.role === "admin") {
    const chapter = await getChapter(chapterId);
    return chapter ? applyRedaction(chapter, view) : null;
  }

  let query = supabaseAdmin
    .from("chapters")
    .select("*, books!inner(status)")
    .eq("id", chapterId)
    .eq("status", "published")
    .eq("books.status", "published");

  if (!canSeeGatedChapters(user)) query = query.eq("is_explicit", false);

  const { data } = await query.maybeSingle();
  if (!data) return null;
  const { books: _book, ...rest } = data as Chapter & { books: unknown };
  return applyRedaction(rest as Chapter, view);
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
      recap: fields.recap ?? "",
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
  const { error } = await supabaseAdmin.from("chapters").delete().eq("id", id);
  if (error) throw error;
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
// Webtoon chapter images (metadata only; image bytes live in Cloudflare R2)
// ============================================================
export async function listChapterImages(chapterId: string): Promise<ChapterImage[]> {
  const { data, error } = await supabaseAdmin
    .from("chapter_images")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChapterImage[];
}

export async function addChapterImages(
  chapterId: string,
  images: Array<Omit<ChapterImage, "id" | "chapter_id" | "position" | "created_at">>
): Promise<ChapterImage[]> {
  if (images.length === 0) return [];
  const existing = await listChapterImages(chapterId);
  const start = existing.length;
  const { data, error } = await supabaseAdmin
    .from("chapter_images")
    .insert(images.map((image, offset) => ({ ...image, chapter_id: chapterId, position: start + offset })))
    .select("*");
  if (error) throw error;
  return (data ?? []) as ChapterImage[];
}

export async function getChapterImage(id: string): Promise<ChapterImage | null> {
  const { data, error } = await supabaseAdmin
    .from("chapter_images")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ChapterImage) ?? null;
}

export async function deleteChapterImage(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("chapter_images").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderChapterImages(chapterId: string, orderedIds: string[]): Promise<void> {
  const current = await listChapterImages(chapterId);
  if (
    current.length !== orderedIds.length ||
    current.some((image) => !orderedIds.includes(image.id))
  ) {
    throw new Error("Image order did not match this chapter.");
  }

  // Move to unique temporary positions first to avoid violating the
  // (chapter_id, position) constraint while two rows swap places.
  for (let index = 0; index < orderedIds.length; index++) {
    const { error } = await supabaseAdmin
      .from("chapter_images")
      .update({ position: 1_000_000 + index })
      .eq("id", orderedIds[index])
      .eq("chapter_id", chapterId);
    if (error) throw error;
  }
  for (let index = 0; index < orderedIds.length; index++) {
    const { error } = await supabaseAdmin
      .from("chapter_images")
      .update({ position: index })
      .eq("id", orderedIds[index])
      .eq("chapter_id", chapterId);
    if (error) throw error;
  }
}

export async function listBookImageObjectKeys(bookId: string): Promise<string[]> {
  const chapters = await listChapters(bookId);
  const imageLists = await Promise.all(chapters.map((chapter) => listChapterImages(chapter.id)));
  return imageLists.flat().map((image) => image.object_key);
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
  const { error } = await supabaseAdmin
    .from("users")
    // Granting spicy access turns off cal mode — the two are mutually exclusive.
    .update({ has_explicit_access: hasAccess, ...(hasAccess ? { cal_mode: false } : {}) })
    .eq("id", userId)
    .eq("role", "reader");
  // Surface DB failures instead of swallowing them — a missing `cal_mode` column
  // (migration 0003 not applied) used to make this silently no-op, so the toggle
  // looked dead in the UI. Throwing lets the caller show why.
  if (error) throw new Error(`Could not update spicy access: ${error.message}`);
}

/** Toggle "cal mode" for a reader. Turning it on clears explicit access (the two
 *  are mutually exclusive): a cal-mode reader sees no spicy content at all. */
export async function setReaderCalMode(userId: string, on: boolean): Promise<void> {
  const { error } = await supabaseAdmin
    .from("users")
    .update({ cal_mode: on, ...(on ? { has_explicit_access: false } : {}) })
    .eq("id", userId)
    .eq("role", "reader");
  if (error) throw new Error(`Could not update cal mode: ${error.message}`);
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

/** Add active seconds to a single chapter's running total. */
export async function addChapterReadingTime(
  userId: string,
  bookId: string,
  chapterId: string,
  seconds: number
): Promise<void> {
  const add = Math.max(0, Math.round(seconds));
  if (add === 0) return;
  const { data } = await supabaseAdmin
    .from("chapter_reading_time")
    .select("total_seconds")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId)
    .maybeSingle();
  const total = (data?.total_seconds ?? 0) + add;
  await supabaseAdmin.from("chapter_reading_time").upsert({
    user_id: userId,
    chapter_id: chapterId,
    book_id: bookId,
    total_seconds: total,
    updated_at: new Date().toISOString(),
  });
}

/** Add active seconds to the reader-local (day, hour) bucket. */
export async function addHourlyReadingTime(
  userId: string,
  day: string, // YYYY-MM-DD (reader-local)
  hourOfDay: number,
  seconds: number
): Promise<void> {
  const add = Math.max(0, Math.round(seconds));
  if (add === 0) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const hour = Math.trunc(hourOfDay);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
  const { data } = await supabaseAdmin
    .from("reading_time_hourly")
    .select("seconds")
    .eq("user_id", userId)
    .eq("day", day)
    .eq("hour_of_day", hour)
    .maybeSingle();
  const total = (data?.seconds ?? 0) + add;
  await supabaseAdmin
    .from("reading_time_hourly")
    .upsert({ user_id: userId, day, hour_of_day: hour, seconds: total });
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
  avatarUrl: string | null;
  readCount: number;
  total: number;
  pct: number;
  /** 1-based number of the chapter they're currently on (book order), or null. */
  currentChapterNumber: number | null;
  /** Total active seconds this person has spent reading this book. */
  totalSeconds: number;
}

/**
 * Readers' progress through a book, for the contents-page widget. Progress is
 * chapters-opened / total published chapters. Admins are excluded; only readers
 * who have actually started the book are returned, ordered furthest-along first.
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
      supabaseAdmin.from("users").select("id, name").eq("revoked", false).eq("role", "reader"),
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

  const avatars = await getAvatars(((users ?? []) as { id: string }[]).map((u) => u.id));

  const rows: ReaderBookProgress[] = [];
  for (const u of (users ?? []) as { id: string; name: string }[]) {
    const readCount = readsByUser.get(u.id)?.size ?? 0;
    const prog = progByUser.get(u.id);
    if (readCount === 0 && !prog) continue; // hasn't started this book

    const curId = prog?.chapter_id ?? null;
    rows.push({
      userId: u.id,
      name: u.name,
      avatarUrl: avatars.get(u.id) ?? null,
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

// ============================================================
// Avatars (compressed profile photos, stored as data URIs)
// ============================================================

/** Data-URI avatars for a set of users, keyed by user id (missing = no avatar). */
export async function getAvatars(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("user_avatars")
    .select("user_id, data_uri")
    .in("user_id", userIds);
  for (const row of data ?? []) map.set(row.user_id as string, row.data_uri as string);
  return map;
}

export async function getAvatar(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_avatars")
    .select("data_uri")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.data_uri as string) ?? null;
}

export async function setAvatar(userId: string, dataUri: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_avatars")
    .upsert({ user_id: userId, data_uri: dataUri, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Could not save avatar: ${error.message}`);
}

export async function deleteAvatar(userId: string): Promise<void> {
  await supabaseAdmin.from("user_avatars").delete().eq("user_id", userId);
}

// ============================================================
// Presence (who's reading right now)
// ============================================================

/** A presence beat is "online" if it landed within this window and was active. */
const PRESENCE_ONLINE_MS = 45_000;

/** 1-based position of each published chapter within a book, in reading order. */
async function chapterNumberMap(bookId: string): Promise<Map<string, number>> {
  const { data } = await supabaseAdmin
    .from("chapters")
    .select("id")
    .eq("book_id", bookId)
    .eq("status", "published")
    .order("position", { ascending: true });
  const map = new Map<string, number>();
  (data ?? []).forEach((c, i) => map.set(c.id as string, i + 1));
  return map;
}

/**
 * Upsert a reader's live location. Called on the reading-time flush, so presence
 * rides the existing ~15s cadence rather than a separate heartbeat. Best-effort:
 * a failure here (e.g. table missing before the migration runs) must never break
 * reading-time tracking, so we log and move on rather than throw.
 */
export async function upsertPresence(input: {
  userId: string;
  bookId: string | null;
  chapterId: string | null;
  scrollFraction: number;
  active: boolean;
}): Promise<void> {
  const frac = Math.min(1, Math.max(0, Number(input.scrollFraction) || 0));
  const { error } = await supabaseAdmin.from("reader_presence").upsert({
    user_id: input.userId,
    book_id: input.bookId,
    chapter_id: input.chapterId,
    scroll_fraction: frac,
    is_active: input.active,
    last_beat_at: new Date().toISOString(),
  });
  if (error) console.error("upsertPresence failed:", error.message);
}

/**
 * Readers who are actively reading right now — a fresh, active presence beat —
 * excluding the viewer, admins, revoked accounts, and anyone who has opted out
 * of sharing activity. When `viewerBookId` is given, `sameBook` flags readers in
 * that same book (so the reader UI can ring them and show their chapter number).
 * Same-book readers sort first, then alphabetically.
 */
export async function getOnlinePresence(
  viewerId: string,
  viewerBookId?: string | null
): Promise<PresenceEntry[]> {
  const cutoff = new Date(Date.now() - PRESENCE_ONLINE_MS).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("reader_presence")
    .select("user_id, book_id, chapter_id, is_active, last_beat_at")
    .eq("is_active", true)
    .gte("last_beat_at", cutoff);

  const others = ((rows ?? []) as {
    user_id: string;
    book_id: string | null;
    chapter_id: string | null;
  }[]).filter((p) => p.user_id !== viewerId);
  if (others.length === 0) return [];

  const ids = others.map((p) => p.user_id);
  const [{ data: users }, { data: settings }, avatars] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, role, revoked").in("id", ids),
    supabaseAdmin.from("reader_settings").select("user_id, share_activity").in("user_id", ids),
    getAvatars(ids),
  ]);
  const userById = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      u as { id: string; name: string; role: Role; revoked: boolean },
    ])
  );
  const shareById = new Map(
    (settings ?? []).map((s) => [
      s.user_id as string,
      (s as { share_activity: boolean | null }).share_activity,
    ])
  );

  // Resolve book titles and per-book chapter numbering, once per distinct book.
  const bookIds = Array.from(
    new Set(others.map((p) => p.book_id).filter((b): b is string => !!b))
  );
  const titleById = new Map<string, string>();
  const numberMaps = new Map<string, Map<string, number>>();
  if (bookIds.length) {
    const { data: books } = await supabaseAdmin
      .from("books")
      .select("id, title")
      .in("id", bookIds);
    (books ?? []).forEach((b) => titleById.set(b.id as string, b.title as string));
    await Promise.all(
      bookIds.map(async (bid) => numberMaps.set(bid, await chapterNumberMap(bid)))
    );
  }

  const out: PresenceEntry[] = [];
  for (const p of others) {
    const u = userById.get(p.user_id);
    if (!u || u.revoked || u.role !== "reader") continue; // readers only
    if (shareById.get(p.user_id) === false) continue; // opted out
    const chapterNumber =
      p.book_id && p.chapter_id ? numberMaps.get(p.book_id)?.get(p.chapter_id) ?? null : null;
    out.push({
      userId: p.user_id,
      name: u.name,
      avatarUrl: avatars.get(p.user_id) ?? null,
      bookId: p.book_id,
      bookTitle: p.book_id ? titleById.get(p.book_id) ?? null : null,
      chapterNumber,
      sameBook: !!viewerBookId && p.book_id === viewerBookId,
    });
  }
  out.sort((a, b) => Number(b.sameBook) - Number(a.sameBook) || a.name.localeCompare(b.name));
  return out;
}

// ============================================================
// Nudges (ephemeral bump / quick-text)
// ============================================================

const NUDGE_MAX_BODY = 140;
const NUDGE_MIN_INTERVAL_MS = 3_000; // per sender→recipient, anti-spam
const NUDGE_TTL_MS = 120_000; // undelivered nudges expire after this

/** Send a bump or short text to another reader. Nothing is stored long-term. */
export async function sendNudge(
  fromUserId: string,
  toUserId: string,
  kind: NudgeKind,
  body: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (fromUserId === toUserId) return { ok: false, error: "You can't nudge yourself." };
  const text = kind === "text" ? (body ?? "").replace(/\s+/g, " ").trim().slice(0, NUDGE_MAX_BODY) : null;
  if (kind === "text" && !text) return { ok: false, error: "Say something first." };

  // Recipient must be a real, non-revoked reader who shares activity.
  const [{ data: recipient }, { data: setting }] = await Promise.all([
    supabaseAdmin.from("users").select("role, revoked").eq("id", toUserId).maybeSingle(),
    supabaseAdmin.from("reader_settings").select("share_activity").eq("user_id", toUserId).maybeSingle(),
  ]);
  if (!recipient || recipient.revoked || recipient.role !== "reader") {
    return { ok: false, error: "That reader isn't available." };
  }
  if (setting && setting.share_activity === false) {
    return { ok: false, error: "That reader isn't available." };
  }

  // Rate limit: one nudge per few seconds per sender→recipient.
  const since = new Date(Date.now() - NUDGE_MIN_INTERVAL_MS).toISOString();
  const { count } = await supabaseAdmin
    .from("reader_nudges")
    .select("id", { count: "exact", head: true })
    .eq("from_user_id", fromUserId)
    .eq("to_user_id", toUserId)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return { ok: false, error: "Slow down a moment." };

  const { error } = await supabaseAdmin
    .from("reader_nudges")
    .insert({ from_user_id: fromUserId, to_user_id: toUserId, kind, body: text });
  if (error) return { ok: false, error: "Could not send." };
  return { ok: true };
}

/**
 * Return the pending nudges for a reader and delete them in the same call —
 * delivered nudges are not retained. Also sweeps anything undelivered past its
 * TTL so the table only ever holds a few seconds of in-flight nudges.
 */
export async function takePendingNudges(userId: string): Promise<IncomingNudge[]> {
  await supabaseAdmin
    .from("reader_nudges")
    .delete()
    .lt("created_at", new Date(Date.now() - NUDGE_TTL_MS).toISOString());

  const { data } = await supabaseAdmin
    .from("reader_nudges")
    .select("id, from_user_id, kind, body")
    .eq("to_user_id", userId)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as {
    id: string;
    from_user_id: string;
    kind: NudgeKind;
    body: string | null;
  }[];
  if (rows.length === 0) return [];

  const fromIds = Array.from(new Set(rows.map((r) => r.from_user_id)));
  const { data: users } = await supabaseAdmin.from("users").select("id, name").in("id", fromIds);
  const nameById = new Map((users ?? []).map((u) => [u.id as string, u.name as string]));

  // Delete-on-deliver: remove exactly the rows we're handing back.
  await supabaseAdmin
    .from("reader_nudges")
    .delete()
    .in("id", rows.map((r) => r.id));

  return rows.map((r) => ({
    id: r.id,
    fromName: nameById.get(r.from_user_id) ?? "Someone",
    kind: r.kind,
    body: r.body,
  }));
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
  user: SpicyUser,
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
// Reading-stats dashboard
// ============================================================

export interface ReaderStatsSummary {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalSeconds: number;
  booksStarted: number;
  booksFinished: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  lastReadAt: string | null;
}

export interface ChapterTime {
  chapterId: string;
  number: number;
  title: string;
  seconds: number;
}

export interface BookStats {
  bookId: string;
  title: string;
  total: number;
  readCount: number;
  pct: number;
  currentChapterNumber: number | null;
  totalSeconds: number;
  estRemainingSeconds: number | null;
  chapters: ChapterTime[];
}

export interface DayHours {
  day: string; // YYYY-MM-DD
  total: number;
  hours: number[]; // length 24
}

export interface ReaderStats {
  summary: ReaderStatsSummary;
  books: BookStats[];
  hourlyByDay: DayHours[]; // newest day first
  hourTotals: number[]; // length 24, across all days
}

export type ReaderStatsResult =
  | { kind: "stats"; stats: ReaderStats }
  | { kind: "private"; name: string; avatarUrl: string | null }
  | { kind: "notfound" };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Current + longest streak (in days) and total active days from a list of days. */
function computeStreaks(days: string[]): {
  current: number;
  longest: number;
  activeDays: number;
} {
  const set = new Set(days);
  if (set.size === 0) return { current: 0, longest: 0, activeDays: 0 };
  const sorted = Array.from(set).sort(); // lexicographic = chronological for YYYY-MM-DD
  const DAY = 86_400_000;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (new Date(`${sorted[i]}T00:00:00`).getTime() -
        new Date(`${sorted[i - 1]}T00:00:00`).getTime()) /
        DAY
    );
    if (diff === 1) run++;
    else run = 1;
    if (run > longest) longest = run;
  }

  const today = new Date();
  const todayStr = ymd(today);
  const yestStr = ymd(new Date(today.getTime() - DAY));
  let current = 0;
  if (set.has(todayStr) || set.has(yestStr)) {
    let cursor = set.has(todayStr) ? today : new Date(today.getTime() - DAY);
    while (set.has(ymd(cursor))) {
      current++;
      cursor = new Date(cursor.getTime() - DAY);
    }
  }
  return { current, longest, activeDays: set.size };
}

/**
 * Per-reader summary rows for the stats overview. Only readers who share their
 * activity are included (plus the viewer themselves). Sorted by time read.
 */
export async function getReadingStatsOverview(viewerId: string): Promise<ReaderStatsSummary[]> {
  const [{ data: pub }, { data: users }, { data: settings }, { data: reads }, { data: times }, { data: progress }, { data: hours }] =
    await Promise.all([
      supabaseAdmin.from("chapters").select("id, book_id").eq("status", "published"),
      supabaseAdmin.from("users").select("id, name").eq("revoked", false).eq("role", "reader"),
      supabaseAdmin.from("reader_settings").select("user_id, share_activity"),
      supabaseAdmin.from("chapter_reads").select("user_id, book_id, chapter_id"),
      supabaseAdmin.from("reading_time").select("user_id, total_seconds, updated_at"),
      supabaseAdmin.from("reading_progress").select("user_id, updated_at"),
      supabaseAdmin.from("reading_time_hourly").select("user_id, day"),
    ]);

  const publishedByBook = new Map<string, Set<string>>();
  for (const c of pub ?? []) {
    const s = publishedByBook.get(c.book_id as string) ?? new Set<string>();
    s.add(c.id as string);
    publishedByBook.set(c.book_id as string, s);
  }

  const readerList = (users ?? []) as { id: string; name: string }[];
  const avatars = await getAvatars(readerList.map((u) => u.id));
  const shareById = new Map(
    (settings ?? []).map((s) => [s.user_id as string, (s as { share_activity: boolean | null }).share_activity])
  );

  const readsByUser = new Map<string, Map<string, Set<string>>>();
  for (const r of reads ?? []) {
    const pubSet = publishedByBook.get(r.book_id as string);
    if (!pubSet || !pubSet.has(r.chapter_id as string)) continue;
    let m = readsByUser.get(r.user_id as string);
    if (!m) {
      m = new Map();
      readsByUser.set(r.user_id as string, m);
    }
    let set = m.get(r.book_id as string);
    if (!set) {
      set = new Set();
      m.set(r.book_id as string, set);
    }
    set.add(r.chapter_id as string);
  }

  const timeByUser = new Map<string, number>();
  const lastByUser = new Map<string, string>();
  const bump = (uid: string, at: string | null | undefined) => {
    if (at && (!lastByUser.get(uid) || at > (lastByUser.get(uid) as string))) lastByUser.set(uid, at);
  };
  for (const t of times ?? []) {
    timeByUser.set(
      t.user_id as string,
      (timeByUser.get(t.user_id as string) ?? 0) + ((t.total_seconds as number) ?? 0)
    );
    bump(t.user_id as string, t.updated_at as string);
  }
  for (const p of progress ?? []) bump(p.user_id as string, p.updated_at as string);

  const daysByUser = new Map<string, string[]>();
  for (const h of hours ?? []) {
    const arr = daysByUser.get(h.user_id as string) ?? [];
    arr.push(h.day as string);
    daysByUser.set(h.user_id as string, arr);
  }

  const rows: ReaderStatsSummary[] = [];
  for (const u of readerList) {
    const isSelf = u.id === viewerId;
    if (!isSelf && shareById.get(u.id) === false) continue; // opted out — hidden from others
    const booksMap = readsByUser.get(u.id) ?? new Map<string, Set<string>>();
    let booksFinished = 0;
    for (const [bId, set] of booksMap) {
      const pubCount = publishedByBook.get(bId)?.size ?? 0;
      if (pubCount > 0 && set.size >= pubCount) booksFinished++;
    }
    const streaks = computeStreaks(daysByUser.get(u.id) ?? []);
    rows.push({
      userId: u.id,
      name: u.name,
      avatarUrl: avatars.get(u.id) ?? null,
      totalSeconds: timeByUser.get(u.id) ?? 0,
      booksStarted: booksMap.size,
      booksFinished,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      activeDays: streaks.activeDays,
      lastReadAt: lastByUser.get(u.id) ?? null,
    });
  }
  rows.sort((a, b) => b.totalSeconds - a.totalSeconds || a.name.localeCompare(b.name));
  return rows;
}

/** Full stats for one reader's detail page (respects the share-activity opt-out). */
export async function getReaderStats(viewerId: string, targetId: string): Promise<ReaderStatsResult> {
  const { data: target } = await supabaseAdmin
    .from("users")
    .select("id, name, role, revoked")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.revoked || target.role !== "reader") return { kind: "notfound" };

  const avatarUrl = await getAvatar(targetId);

  if (targetId !== viewerId) {
    const { data: setting } = await supabaseAdmin
      .from("reader_settings")
      .select("share_activity")
      .eq("user_id", targetId)
      .maybeSingle();
    if (setting && setting.share_activity === false) {
      return { kind: "private", name: target.name as string, avatarUrl };
    }
  }

  const [{ data: pub }, { data: reads }, { data: times }, { data: progress }, { data: chTimes }, { data: hours }] =
    await Promise.all([
      supabaseAdmin
        .from("chapters")
        .select("id, book_id, title, position")
        .eq("status", "published")
        .order("position", { ascending: true }),
      supabaseAdmin.from("chapter_reads").select("book_id, chapter_id").eq("user_id", targetId),
      supabaseAdmin.from("reading_time").select("book_id, total_seconds, updated_at").eq("user_id", targetId),
      supabaseAdmin.from("reading_progress").select("book_id, chapter_id, updated_at").eq("user_id", targetId),
      supabaseAdmin.from("chapter_reading_time").select("book_id, chapter_id, total_seconds").eq("user_id", targetId),
      supabaseAdmin.from("reading_time_hourly").select("day, hour_of_day, seconds").eq("user_id", targetId),
    ]);

  // Published chapters grouped/ordered per book.
  const chaptersByBook = new Map<string, { id: string; title: string }[]>();
  for (const c of pub ?? []) {
    const arr = chaptersByBook.get(c.book_id as string) ?? [];
    arr.push({ id: c.id as string, title: c.title as string });
    chaptersByBook.set(c.book_id as string, arr);
  }
  const numberById = new Map<string, number>();
  const bookIdByChapter = new Map<string, string>();
  for (const [bId, list] of chaptersByBook) {
    list.forEach((c, i) => {
      numberById.set(c.id, i + 1);
      bookIdByChapter.set(c.id, bId);
    });
  }

  const readsByBook = new Map<string, Set<string>>();
  for (const r of reads ?? []) {
    if (!numberById.has(r.chapter_id as string)) continue;
    const set = readsByBook.get(r.book_id as string) ?? new Set<string>();
    set.add(r.chapter_id as string);
    readsByBook.set(r.book_id as string, set);
  }
  const timeByBook = new Map<string, number>();
  let lastReadAt: string | null = null;
  for (const t of times ?? []) {
    timeByBook.set(t.book_id as string, (t.total_seconds as number) ?? 0);
    if (t.updated_at && (!lastReadAt || (t.updated_at as string) > lastReadAt)) lastReadAt = t.updated_at as string;
  }
  const progByBook = new Map<string, string | null>();
  for (const p of progress ?? []) {
    progByBook.set(p.book_id as string, (p.chapter_id as string) ?? null);
    if (p.updated_at && (!lastReadAt || (p.updated_at as string) > lastReadAt)) lastReadAt = p.updated_at as string;
  }
  const chapterSeconds = new Map<string, number>();
  for (const ct of chTimes ?? []) chapterSeconds.set(ct.chapter_id as string, (ct.total_seconds as number) ?? 0);

  // Book titles for started books.
  const startedBookIds = Array.from(
    new Set([...readsByBook.keys(), ...progByBook.keys()].filter((b) => chaptersByBook.has(b)))
  );
  const titleById = new Map<string, string>();
  if (startedBookIds.length) {
    const { data: books } = await supabaseAdmin.from("books").select("id, title").in("id", startedBookIds);
    for (const b of books ?? []) titleById.set(b.id as string, b.title as string);
  }

  const books: BookStats[] = [];
  let booksFinished = 0;
  let totalSeconds = 0;
  for (const bId of startedBookIds) {
    const list = chaptersByBook.get(bId) ?? [];
    const total = list.length;
    const readSet = readsByBook.get(bId) ?? new Set<string>();
    const readCount = readSet.size;
    const pct = total > 0 ? Math.min(100, Math.round((readCount / total) * 100)) : 0;
    const bookSeconds = timeByBook.get(bId) ?? 0;
    totalSeconds += bookSeconds;
    if (total > 0 && readCount >= total) booksFinished++;

    const curId = progByBook.get(bId) ?? null;
    const chapters: ChapterTime[] = list
      .map((c) => ({
        chapterId: c.id,
        number: numberById.get(c.id) ?? 0,
        title: c.title,
        seconds: chapterSeconds.get(c.id) ?? 0,
      }))
      .filter((c) => c.seconds > 0);

    const avgPerRead = readCount > 0 ? bookSeconds / readCount : 0;
    const remaining = total - readCount;
    books.push({
      bookId: bId,
      title: titleById.get(bId) ?? "Untitled",
      total,
      readCount,
      pct,
      currentChapterNumber: curId ? numberById.get(curId) ?? null : null,
      totalSeconds: bookSeconds,
      estRemainingSeconds: avgPerRead > 0 && remaining > 0 ? Math.round(avgPerRead * remaining) : null,
      chapters,
    });
  }
  books.sort((a, b) => b.totalSeconds - a.totalSeconds);

  // Hourly grouped by day.
  const byDay = new Map<string, number[]>();
  const hourTotals = new Array(24).fill(0);
  for (const h of hours ?? []) {
    const day = h.day as string;
    const hour = h.hour_of_day as number;
    const secs = (h.seconds as number) ?? 0;
    const arr = byDay.get(day) ?? new Array(24).fill(0);
    arr[hour] = (arr[hour] ?? 0) + secs;
    byDay.set(day, arr);
    hourTotals[hour] += secs;
  }
  const hourlyByDay: DayHours[] = Array.from(byDay.entries())
    .map(([day, hrs]) => ({ day, hours: hrs, total: hrs.reduce((s, v) => s + v, 0) }))
    .sort((a, b) => (a.day < b.day ? 1 : -1)); // newest first

  const allDays = Array.from(byDay.keys());
  const streaks = computeStreaks(allDays);

  const summary: ReaderStatsSummary = {
    userId: targetId,
    name: target.name as string,
    avatarUrl,
    totalSeconds,
    booksStarted: startedBookIds.length,
    booksFinished,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    activeDays: streaks.activeDays,
    lastReadAt,
  };

  return { kind: "stats", stats: { summary, books, hourlyByDay, hourTotals } };
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
  user: SpicyUser
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
