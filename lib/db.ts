import { promises as fs } from "node:fs";
import path from "node:path";
import { CONFIG } from "@/lib/config";
import type { AuthSession, AuthUser } from "@/lib/auth";
import type { SavedProperty } from "@/lib/saved";
import type { DemoRequest } from "@/lib/demo";
import type { ReportRequest } from "@/lib/reportRequest";

/**
 * Persistence facade (server-only).
 *
 * All account data flows through `readData`/`writeData`. The concrete backend
 * is chosen once per process from `DATA_PROVIDER`:
 *   - "file"   (default): a JSON document in `APP_DATA_FILE`.
 *   - "sqlite": a SQLite database in `SQLITE_FILE` (Node 22.5+/24).
 *
 * Both implement the same document-shaped interface, so swapping the database
 * is a config change, not a code change.
 */

export interface DataFile {
  users: AuthUser[];
  sessions: AuthSession[];
  saved: Record<string, SavedProperty[]>;
  demoRequests: DemoRequest[];
  reportRequests: ReportRequest[];
}

export function emptyData(): DataFile {
  return { users: [], sessions: [], saved: {}, demoRequests: [], reportRequests: [] };
}

export interface DataBackend {
  /** Read the whole document. */
  read(): Promise<DataFile>;
  /** Mutate and persist atomically. */
  write(mutate: (prev: DataFile) => Promise<DataFile> | DataFile): Promise<DataFile>;
}

/** Serialize concurrent writes so parallel requests don't clobber the file. */
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/** File-backed (JSON document) backend. Exported for tests. */
export class FileDataBackend implements DataBackend {
  constructor(private file: string) {}

  read(): Promise<DataFile> {
    return fs
      .readFile(this.file, "utf8")
      .then((raw) => JSON.parse(raw) as Partial<DataFile>)
      .then((p) => ({ ...emptyData(), ...p }))
      .catch(() => emptyData());
  }

  write(mutate: (prev: DataFile) => Promise<DataFile> | DataFile): Promise<DataFile> {
    return serialized(async () => {
      const prev = await this.read();
      const next = await mutate(prev);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(next, null, 2), "utf8");
      return next;
    });
  }
}

let backendPromise: Promise<DataBackend> | null = null;

function getBackend(): Promise<DataBackend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (CONFIG.dataProvider === "sqlite") {
        try {
          const mod = await import("./db/sqlite");
          return new mod.SqliteDataBackend(CONFIG.sqliteFile);
        } catch (err) {
          console.warn(
            "DATA_PROVIDER=sqlite unavailable, falling back to file backend:",
            err,
          );
        }
      }
      return new FileDataBackend(CONFIG.dataFile);
    })();
  }
  return backendPromise;
}

/**
 * Read the whole data document. `target` overrides the path for tests and
 * always uses the file backend.
 */
export async function readData(target?: string): Promise<DataFile> {
  if (target) return new FileDataBackend(target).read();
  const backend = await getBackend();
  return backend.read();
}

/**
 * Mutate and persist the data document atomically.
 * `target` overrides the path for tests and always uses the file backend.
 */
export async function writeData(
  mutate: (prev: DataFile) => Promise<DataFile> | DataFile,
  target?: string,
): Promise<DataFile> {
  if (target) return new FileDataBackend(target).write(mutate);
  const backend = await getBackend();
  return backend.write(mutate);
}