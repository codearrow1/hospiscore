import { promises as fs } from "node:fs";
import path from "node:path";
import { CONFIG } from "@/lib/config";
import type { AuthSession, AuthUser } from "@/lib/auth";
import type { SavedProperty } from "@/lib/saved";
import type { DemoRequest } from "@/lib/demo";
import type { ReportRequest } from "@/lib/reportRequest";
import type { PricingDoc } from "@/lib/pricing/types";
import type {
  AuditEntry,
  Campaign,
  ConvertedCustomer,
  DemoBooking,
  LeadEvent,
  MarketingFormConfig,
  MarketingLead,
  PageView,
} from "@/lib/marketing/types";

/**
 * Persistence facade (server-only).
 *
 * All account data flows through `readData`/`writeData`. The concrete backend
 * is chosen once per process from `DATA_PROVIDER`:
 *   - "file"   (default): a JSON document in `APP_DATA_FILE`, kept mirrored to
 *                `APP_DATA_MIRROR` (default `<home>/.hospiscore/data.json`) so
 *                data survives deploys that replace the app directory.
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
  /** Localized pricing document (seeded on first use; see lib/pricing/db.ts). */
  pricing?: PricingDoc | null;
  /** Marketing conversion center (CRM). All optional; seeded lazily. */
  leads?: MarketingLead[];
  leadEvents?: LeadEvent[];
  demoBookings?: DemoBooking[];
  campaigns?: Campaign[];
  forms?: MarketingFormConfig[];
  auditLog?: AuditEntry[];
  pageViews?: PageView[];
  convertedCustomers?: ConvertedCustomer[];
}

export function emptyData(): DataFile {
  return {
    users: [],
    sessions: [],
    saved: {},
    demoRequests: [],
    reportRequests: [],
    pricing: null,
    leads: [],
    leadEvents: [],
    demoBookings: [],
    campaigns: [],
    forms: [],
    auditLog: [],
    pageViews: [],
    convertedCustomers: [],
  };
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

/** File-backed (JSON document) backend. Exported for tests.
 *
 * `mirror` is a secondary copy kept in sync with every write and used as a
 * fallback when the primary file is missing or has been reset (e.g. a deploy
 * that replaces the app directory). Best-effort: mirror failures never fail a
 * write.
 */
export class FileDataBackend implements DataBackend {
  constructor(private file: string, private mirror?: string) {}

  async read(): Promise<DataFile> {
    const primary = await this.tryLoad(this.file);
    if (primary !== null && !this.looksFresh(primary)) {
      return { ...emptyData(), ...primary };
    }
    if (this.mirror) {
      const mirrored = await this.tryLoad(this.mirror);
      if (mirrored !== null && !this.looksFresh(mirrored)) {
        return { ...emptyData(), ...mirrored };
      }
    }
    return { ...emptyData(), ...(primary ?? {}) };
  }

  private async tryLoad(file: string): Promise<Partial<DataFile> | null> {
    try {
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw) as Partial<DataFile>;
    } catch {
      return null;
    }
  }

  /** Never-stored-anything document (fresh install or a wiped/reset file). */
  private looksFresh(doc: Partial<DataFile>): boolean {
    const users = Array.isArray(doc.users) ? doc.users.length : 0;
    const sessions = Array.isArray(doc.sessions) ? doc.sessions.length : 0;
    return users === 0 && sessions === 0;
  }

  write(mutate: (prev: DataFile) => Promise<DataFile> | DataFile): Promise<DataFile> {
    return serialized(async () => {
      const prev = await this.read();
      const next = await mutate(prev);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(next, null, 2), "utf8");
      if (this.mirror) {
        try {
          await fs.mkdir(path.dirname(this.mirror), { recursive: true });
          await fs.copyFile(this.file, this.mirror);
        } catch {
          /* mirror is best-effort */
        }
      }
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
      const mirror =
        CONFIG.dataMirror && CONFIG.dataMirror !== CONFIG.dataFile ? CONFIG.dataMirror : undefined;
      return new FileDataBackend(CONFIG.dataFile, mirror);
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