import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

// Clears the session cookie, then sends the user to the login screen. Used both
// for explicit logout and to recover a stale cookie (e.g. a revoked/deleted user
// whose signed cookie is still valid) without an infinite redirect loop.
export async function GET(req: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", req.url));
}
