import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOnlinePresence } from "@/lib/data";

// Who is reading right now, for the polling clients (library strip, reader
// top-bar cluster, "who's reading" widget). Reads cookies + query, so it's
// always dynamic — never cached.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bookId = new URL(req.url).searchParams.get("bookId");
  const online = await getOnlinePresence(user.id, bookId);
  return NextResponse.json({ online });
}
