import { NextResponse } from "next/server";
import { APP_VERSION, BUILD_ID } from "@/lib/version";

// Reports the currently-deployed version + build id, straight from the build
// environment (Vercel) — never the database. A running client compares this to
// its own baked-in build id to notice when a newer deploy is live. Must not be
// cached, so a stale tab reliably sees the new build id after a deploy.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION, buildId: BUILD_ID },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
