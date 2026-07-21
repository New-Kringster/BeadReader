export type Role = "admin" | "reader";
export type PublishStatus = "draft" | "published";
export type Layout = "scroll" | "page";
export type BookFormat = "text" | "webtoon";

export interface User {
  id: string;
  name: string;
  role: Role;
  access_code: string;
  has_explicit_access: boolean;
  /** "Cal mode": reader sees the book as if it had no spicy content at all —
   *  inline spicy passages are removed seamlessly, whole spicy chapters stay
   *  hidden, and no 🌶 markers show. Mutually exclusive with explicit access. */
  cal_mode: boolean;
  revoked: boolean;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  description: string | null;
  status: PublishStatus;
  format: BookFormat;
  created_at: string;
  updated_at: string;
}

export interface ChapterImage {
  id: string;
  chapter_id: string;
  position: number;
  object_key: string;
  original_filename: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  byte_size: number;
  created_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  title: string;
  position: number;
  content: string;
  /** Optional short summary of the chapter (Markdown), shown in a collapsible
   *  "Recap" panel at the end of the chapter. Empty string when unset. */
  recap: string;
  status: PublishStatus;
  is_explicit: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReaderSettings {
  user_id: string;
  bg_color: string;
  text_color: string;
  font_size: number;
  layout: Layout;
  /** Opt-in (default true) to the social presence/stats layer — see others and
   *  be seen. When false, this reader is hidden from presence and stats. */
  share_activity: boolean;
  updated_at: string;
}

/** A reader who is online right now, resolved for display. Client-safe. */
export interface PresenceEntry {
  userId: string;
  name: string;
  /** Compressed data-URI avatar, or null when the reader hasn't set one. */
  avatarUrl: string | null;
  bookId: string | null;
  bookTitle: string | null;
  /** 1-based chapter number in book order, or null if unknown/browsing. */
  chapterNumber: number | null;
  /** True when this reader is in the same book as the viewer. */
  sameBook: boolean;
}

export type NudgeKind = "bump" | "text";

/** A nudge delivered to the viewer, for the ephemeral toast. Client-safe. */
export interface IncomingNudge {
  id: string;
  fromName: string;
  kind: NudgeKind;
  body: string | null;
}

export interface ReadingProgress {
  user_id: string;
  book_id: string;
  chapter_id: string | null;
  scroll_fraction: number;
  page: number;
  updated_at: string;
}

export const DEFAULT_SETTINGS: Omit<ReaderSettings, "user_id" | "updated_at"> = {
  bg_color: "#faf8f4",
  text_color: "#1a1a1a",
  font_size: 19,
  layout: "scroll",
  share_activity: true,
};
