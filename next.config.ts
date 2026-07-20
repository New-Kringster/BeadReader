import type { NextConfig } from "next";

// A per-deployment build id, baked into the bundle at build time. Used to detect
// when a newer version has been deployed (see components/VersionWatcher). It is
// derived purely from Vercel's build environment — never the database — so it
// stays correct even while the live DB is used for prototyping. Falls back to a
// timestamp locally so each local build is distinct.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  `dev-${Date.now()}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  experimental: {
    serverActions: {
      // Cover images are uploaded through a Server Action (FormData). The default
      // cap is 1 MB, which crashes on real photos. Raise it; the client also
      // downscales images before upload (see components/CoverField.tsx).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
