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
    // Belt and braces: force every possible spelling of the Prisma runtime
    // specifier onto the CJS file. (scripts/fix-prisma-runtime.mjs rewrites
    // the generated client itself; this covers stale copies.)
    const cjsRuntime = path.resolve(
      process.cwd(),
      "node_modules/@prisma/client/runtime/library.js",
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client/runtime/library.mjs$": cjsRuntime,
      // Exact-match syntax ($ suffix); webpack aliases have no ^ prefix form.
      "@prisma/client/runtime/library$": cjsRuntime,
    };
    return config;
  },
};

export default nextConfig;
