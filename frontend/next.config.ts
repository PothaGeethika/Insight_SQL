import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error("Missing required environment variable: BACKEND_URL");
}

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin requests to dev resources (HMR, chunks)
  // for any host other than localhost. Without this, pages served at
  // http://127.0.0.1:3000 (used in invite emails via FRONTEND_URL) render
  // the SSR HTML but never hydrate — no effects run, so the invite page
  // hangs on "Accepting invite…" forever.
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      {
        // Proxy /api/backend/* → configured BACKEND_URL/*
        // This keeps all backend calls same-origin from the browser,
        // avoids CORS issues in production, and removes hardcoded ports.
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
