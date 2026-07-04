import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error("Missing required environment variable: BACKEND_URL");
}

const nextConfig: NextConfig = {
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
