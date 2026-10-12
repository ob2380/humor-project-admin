import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
