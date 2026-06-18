import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Proxy /api/backend/* → http://localhost:8000/*
        // This keeps all backend calls same-origin from the browser,
        // avoids CORS issues in production, and removes hardcoded ports.
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
