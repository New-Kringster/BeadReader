import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addReadingTime } from "@/lib/data";

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
  const seconds = Number(data.seconds ?? 0);
  if (!bookId || !Number.isFinite(seconds)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // Clamp so a stuck tab can't submit an absurd jump.
  await addReadingTime(user.id, bookId, Math.min(seconds, 600));
  return NextResponse.json({ ok: true });
}
