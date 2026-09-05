import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  marketingLead: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  marketingConvertedCustomer: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  affiliateCommission: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));

import {
  backfillGrowthData,
  relinkCommissions,
} from "@/lib/growth/backfill";
import { writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("backfillGrowthData (checkpoint 3)", () => {
  const scratch = path.join(os.tmpdir(), `growth-backfill-${Date.now()}.json`);

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn(prismaMock),
    );
  });

  afterAll(async () => {
    await unlink(scratch).catch(() => undefined);
  });

  it("upserts leads keyed on legacyLeadId and backfills conversions + commission links", async () => {
    await writeFile(
      scratch,
      JSON.stringify({
        users: [],
        sessions: [],
        saved: {},
        leads: [
          {
            id: "uuid-lead-1",
            name: "A",
            email: "a@x.co",
            source: "organic",
            stage: "new",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        convertedCustomers: [
          {
            id: "cc-1",
            leadId: "uuid-lead-1",
            convertedAt: "2026-02-01T00:00:00.000Z",
            estimatedValue: 1000,
          },
        ],
      }),
      "utf8",
    );

    // Lead already mirrored (findUnique returns it) — update path.
    prismaMock.marketingLead.findUnique.mockImplementation(
      (args: { where: { legacyLeadId?: string } }) => {
        if (args.where.legacyLeadId === "uuid-lead-1")
          return Promise.resolve({ id: "mlead-1" });
        if (args.where.legacyLeadId === "legacy-for-relink")
          return Promise.resolve({ id: "mlead-2" });
        return Promise.resolve(null);
      },
    );
    prismaMock.marketingConvertedCustomer.findUnique.mockResolvedValue(null);
    prismaMock.marketingConvertedCustomer.create.mockResolvedValue({ id: "cc-1" });
    prismaMock.affiliateCommission.findMany.mockResolvedValue([
      { id: "commission-1", legacyLeadId: "legacy-for-relink" },
    ]);
    prismaMock.affiliateCommission.update.mockResolvedValue({ id: "commission-1" });

    const res = await backfillGrowthData(scratch);

    expect(res.leadsSynced).toBe(1);
    expect(prismaMock.marketingLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mlead-1" },
        data: expect.objectContaining({ email: "a@x.co" }),
      }),
    );
    expect(res.convertedCustomersSynced).toBe(1);
    expect(prismaMock.marketingConvertedCustomer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: "mlead-1", estimatedValue: 1000 }),
      }),
    );
    expect(res.relinkedCommissions).toBe(1);
    expect(prismaMock.affiliateCommission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "commission-1" },
        data: { leadId: "mlead-2" },
      }),
    );
  });

  it("skips conversions whose lead has no mirror row yet", async () => {
    await writeFile(
      scratch,
      JSON.stringify({
        users: [],
        sessions: [],
        saved: {},
        leads: [],
        convertedCustomers: [
          {
            id: "cc-orphan",
            leadId: "uuid-missing",
            convertedAt: "2026-02-01T00:00:00.000Z",
            estimatedValue: 0,
          },
        ],
      }),
      "utf8",
    );

    prismaMock.marketingLead.findUnique.mockResolvedValue(null);
    prismaMock.affiliateCommission.findMany.mockResolvedValue([]);

    const res = await backfillGrowthData(scratch);

    expect(res.skippedConversionsWithoutLead).toBe(1);
    expect(prismaMock.marketingConvertedCustomer.create).not.toHaveBeenCalled();
  });

  it("relinkCommissions is idempotent and skips already-linked rows", async () => {
    prismaMock.affiliateCommission.findMany.mockResolvedValue([]);
    await expect(relinkCommissions()).resolves.toBe(0);
    expect(prismaMock.affiliateCommission.update).not.toHaveBeenCalled();
  });
});