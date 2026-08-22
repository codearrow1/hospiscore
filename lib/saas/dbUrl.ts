import os from "node:os";
import path from "node:path";

// Windows dev keeps the repo-relative var/saas.db. On Linux production the
// app runs inside a versioned deploy dir (hbuilds/versions/<id>/nodejs) that
// is replaced on every deployment, so a repo-relative DB would be wiped each
// time; fall back to a persistent path in the user home instead.
function fallbackUrl(): string {
  if (process.platform === "win32") return "file:./var/saas.db";
  return "file:" + path.join(os.homedir(), "saas-data", "saas.db");
}

export function rawDatabaseUrl(): string {
  return process.env.DATABASE_URL || fallbackUrl();
}

export function absoluteSqliteUrl(url: string = rawDatabaseUrl()): string {
  if (!url.startsWith("file:")) return url;
  const raw = url.slice("file:".length);
  const isAbsolute = raw.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(raw);
  if (isAbsolute) return "file:" + path.normalize(raw);
  return "file:" + path.resolve(process.cwd(), raw);
}

export function sqliteFilePath(url: string = rawDatabaseUrl()): string | null {
  if (!url.startsWith("file:")) return null;
  return absoluteSqliteUrl(url).slice("file:".length);
}
