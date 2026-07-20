import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOnlinePresence, takePendingNudges } from "@/lib/data";

// Who is reading right now, for the polling clients (library strip, reader
// top-bar cluster, "who's reading" widget). Also delivers any pending nudges to
// the viewer, riding this single poll (delete-on-deliver happens in
// takePendingNudges). Reads cookies + query, so it's always dynamic.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bookId = new URL(req.url).searchParams.get("bookId");
  const [online, nudges] = await Promise.all([
    getOnlinePresence(user.id, bookId),
    // Admins aren't part of the social layer, so they never receive nudges.
    user.role === "reader" ? takePendingNudges(user.id) : Promise.resolve([]),
  ]);
  return NextResponse.json({ online, nudges });
}
