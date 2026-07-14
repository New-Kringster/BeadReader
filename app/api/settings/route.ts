import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveSettings } from "@/lib/data";
import type { Layout } from "@/lib/types";

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

  const layout: Layout = data.layout === "page" ? "page" : "scroll";
  const fontSize = Math.min(40, Math.max(12, Math.round(Number(data.font_size ?? 19))));
  await saveSettings(user.id, {
    bg_color: String(data.bg_color ?? "#faf8f4").slice(0, 32),
    text_color: String(data.text_color ?? "#1a1a1a").slice(0, 32),
    font_size: fontSize,
    layout,
  });
  return NextResponse.json({ ok: true });
}
