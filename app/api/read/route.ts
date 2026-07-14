import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markChapterRead } from "@/lib/data";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const bookId = String(data.bookId ?? "");
  const chapterId = String(data.chapterId ?? "");
  if (!bookId || !chapterId) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  await markChapterRead(user.id, bookId, chapterId);
  return NextResponse.json({ ok: true });
}
