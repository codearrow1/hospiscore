import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Pin tracing to the repo root: a stray package-lock.json in the user home
  // makes Next infer the wrong workspace root and emit a warning on every run.
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url))),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  webpack(config) {
    // Force the CJS Prisma runtime even if a stale generated client still
    // imports library.mjs. The ESM runtime imports node:process, which crashes
    // under Passenger (fd0 pre-bound) with "Error: open EEXIST" at getStdin.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client/runtime/library.mjs$": path.resolve(
        process.cwd(),
        "node_modules/@prisma/client/runtime/library.js",
      ),
    };
    return config;
  },
};

export default nextConfig;
