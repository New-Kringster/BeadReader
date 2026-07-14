import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getReadableChapter,
  listComments,
  addComment,
  deleteComment,
} from "@/lib/data";

const MAX_LEN = 2000;

// List comments for a chapter the user is allowed to read.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const chapterId = new URL(req.url).searchParams.get("chapterId") ?? "";
  if (!chapterId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Reuse the explicit-content gate: no access to the chapter => no comments.
  const chapter = await getReadableChapter(chapterId, user);
  if (!chapter) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ comments: await listComments(chapterId) });
}

// Post a comment on a chapter the user can read.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let data: { chapterId?: string; body?: string };
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const chapterId = String(data.chapterId ?? "");
  const body = String(data.body ?? "").trim();
  if (!chapterId || !body) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (body.length > MAX_LEN) return NextResponse.json({ error: "too long" }, { status: 400 });

  const chapter = await getReadableChapter(chapterId, user);
  if (!chapter) return NextResponse.json({ error: "not found" }, { status: 404 });

  const comment = await addComment(user.id, chapterId, body);
  return NextResponse.json({ comment });
}

// Delete own comment (or any, if admin).
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const ok = await deleteComment(id, user);
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
