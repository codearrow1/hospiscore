import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { emptyData, type DataBackend, type DataFile } from "@/lib/db";

/**
 * SQLite backend for `lib/db.ts` (Node 22.5+/24 `node:sqlite`).
 *
 * Stores the whole account document as one row in a `meta` table, which keeps
 * the document-shaped `readData`/`writeData` interface intact while gaining a
 * real database file with ACID transactions. Swapping to a relational schema
 * later can replace this class while keeping the facade stable.
 */

/** Serialize writes; `node:sqlite` calls here are synchronous so no deadlock. */
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export class SqliteDataBackend implements DataBackend {
  private db: DatabaseSync;

  constructor(file: string) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }

  read(): Promise<DataFile> {
    const row = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get("doc") as { value: string } | undefined;
    if (!row) return Promise.resolve(emptyData());
    const parsed = JSON.parse(row.value) as Partial<DataFile>;
    return Promise.resolve({ ...emptyData(), ...parsed });
  }

  write(mutate: (prev: DataFile) => Promise<DataFile> | DataFile): Promise<DataFile> {
    return serialized(async () => {
      const row = this.db
        .prepare("SELECT value FROM meta WHERE key = ?")
        .get("doc") as { value: string } | undefined;
      const prev = row ? ({ ...emptyData(), ...JSON.parse(row.value) } as DataFile) : emptyData();
      const next = await mutate(prev);
      this.db
        .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('doc', ?)")
        .run(JSON.stringify(next));
      return next;
    });
  }

  /** Release the underlying handle (must be closed before deleting the file). */
  close(): void {
    this.db.close();
  }
}