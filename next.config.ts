import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
