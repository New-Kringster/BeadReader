import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "./supabase";
import { SESSION_COOKIE, signSession, verifySession } from "./session";
import type { User } from "./types";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — readers shouldn't re-enter codes

/** Look up the logged-in user from the signed cookie. Revoked/missing => null. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token);
  if (!userId) return null;

  const { data } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!data || data.revoked) return null;
  return data as User;
}

/** Any valid, non-revoked user, or redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Admin only. Readers get bounced to their library; guests to /login. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/read");
  return user;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
