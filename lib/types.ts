export type Role = "admin" | "reader";
export type PublishStatus = "draft" | "published";
export type Layout = "scroll" | "page";

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
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  title: string;
  position: number;
  content: string;
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
  updated_at: string;
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
};
