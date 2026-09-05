// Rewrites the generated Prisma client's runtime specifier to the explicit
// CJS file ("@prisma/client/runtime/library.js"). The extensionless form
// resolves via the exports map's "import" condition to library.mjs, whose
// node:process import crashes under Passenger ("open EEXIST"). Runs after
// every prisma generate so regeneration on any host cannot reintroduce it.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|mts|cts|js|mjs|cjs|d\.ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(join(process.cwd(), "lib/generated/prisma"))) {
  const src = readFileSync(file, "utf8");
  const next = src
    .replaceAll('"@prisma/client/runtime/library"', '"@prisma/client/runtime/library.js"')
    .replaceAll('"@prisma/client/runtime/library.mjs"', '"@prisma/client/runtime/library.js"')
    .replaceAll("'@prisma/client/runtime/library'", "'@prisma/client/runtime/library.js'")
    .replaceAll("'@prisma/client/runtime/library.mjs'", "'@prisma/client/runtime/library.js'");
  if (next !== src) {
    writeFileSync(file, next);
    changed++;
  }
}
console.log(`[fix-prisma-runtime] pinned ${changed} file(s) to the CJS runtime`);
