import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  addReadingTime,
  addChapterReadingTime,
  addHourlyReadingTime,
  upsertPresence,
} from "@/lib/data";

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
  const clampedSeconds = Math.min(seconds, 600);
  await addReadingTime(user.id, bookId, clampedSeconds);

  // Presence + fine-grained stats ride this same flush (readers only — admins
  // aren't part of the social layer). The client sends a beat every ~15s and one
  // final inactive beat on hide, which is what makes a reader drop offline.
  if (user.role === "reader") {
    const chapterId = data.chapterId ? String(data.chapterId) : null;
    const scrollFraction = Number(data.scrollFraction ?? 0);
    await upsertPresence({
      userId: user.id,
      bookId,
      chapterId,
      scrollFraction: Number.isFinite(scrollFraction) ? scrollFraction : 0,
      active: data.active !== false, // default true
    });

    if (clampedSeconds > 0) {
      const localDay = typeof data.localDay === "string" ? data.localDay : null;
      const hourOfDay = Number(data.hourOfDay);
      await Promise.all([
        chapterId
          ? addChapterReadingTime(user.id, bookId, chapterId, clampedSeconds)
          : Promise.resolve(),
        localDay && Number.isFinite(hourOfDay)
          ? addHourlyReadingTime(user.id, localDay, hourOfDay, clampedSeconds)
          : Promise.resolve(),
      ]);
    }
  }
  return NextResponse.json({ ok: true });
}
