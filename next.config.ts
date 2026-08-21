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
};

export default nextConfig;
