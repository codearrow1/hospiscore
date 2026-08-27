import { timingSafeEqual } from "node:crypto";

/** Constant-time secret comparison to prevent timing attacks on cron endpoints. */
export function secretsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
