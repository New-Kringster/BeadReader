import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendNudge } from "@/lib/data";
import type { NudgeKind } from "@/lib/types";

// Send an ephemeral bump / quick-text to another reader. Readers only.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "reader") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const toUserId = String(data.toUserId ?? "");
  const kind: NudgeKind = data.kind === "text" ? "text" : "bump";
  const body = typeof data.body === "string" ? data.body : null;
  if (!toUserId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const result = await sendNudge(user.id, toUserId, kind, body);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "failed" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
