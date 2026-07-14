import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Lightweight gate: verifies the session cookie's signature (no DB call here).
 * Role checks and revocation are enforced in the server components via
 * getCurrentUser()/requireAdmin(), which do hit the database on every request.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token);

  // Already signed in and hitting the login screen → send to the library.
  if (pathname === "/login") {
    if (userId) return NextResponse.redirect(new URL("/read", req.url));
    return NextResponse.next();
  }

  // Protected areas require a valid session cookie.
  if (!userId) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/read/:path*"],
};
