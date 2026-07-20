// The human-facing app version. Shown on the login and library pages, and used
// to anchor the changelog and the "what's new" popup. Bump this (and add a
// matching CHANGELOG entry) whenever there are user-facing changes to announce.
export const APP_VERSION = "1.2.0";

// A per-deployment build id, baked in at build time from Vercel's environment
// (see next.config.ts). The running client compares its baked-in copy against
// what /api/version reports; a mismatch means a newer deploy is live and the tab
// is stale. This is intentionally sourced from the build, not the database.
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
