import path from "node:path";

const FALLBACK = "file:./var/saas.db";

export function rawDatabaseUrl(): string {
  return process.env.DATABASE_URL || FALLBACK;
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
