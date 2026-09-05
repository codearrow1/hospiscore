import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  featureFlag: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  marketingLead: {
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  marketingLeadEvent: { count: vi.fn(), create: vi.fn() },
  marketingConvertedCustomer: { create: vi.fn() },
  marketingDemoBooking: { create: vi.fn() },
  marketingReportRequest: { create: vi.fn() },
  $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));

import { upsertLead, convertLead } from "@/lib/marketing/leads";
import { submitDemoRequest } from "@/lib/demo";
import { submitReportRequest } from "@/lib/reportRequest";
import { GROWTH_PERSIST_FLAG, isGrowthPersistEnabled } from "@/lib/growth/flag";
import { writeFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("growth.persist.prisma flag gate", () => {
  const scratch = path.join(os.tmpdir(), `growth-parity-${Date.now()}.json`);
  const flagOff = () =>
    prismaMock.featureFlag.findMany.mockResolvedValue([
      { enabled: false, organizationId: null, planId: null, propertyId: null, country: null },
    ]);
  const flagOn = () =>
    prismaMock.featureFlag.findMany.mockResolvedValue([
      { enabled: true, organizationId: null, planId: null, propertyId: null, country: null },
    ]);

  beforeEach(async () => {
    vi.clearAllMocks();
    await writeFile(scratch, JSON.stringify({ users: [], sessions: [], saved: {} }), "utf8");
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock));
    prismaMock.marketingLead.findUnique.mockResolvedValue(null);
    prismaMock.marketingLead.create.mockResolvedValue({ id: "mlead-1" });
    prismaMock.marketingLead.update.mockResolvedValue({ id: "mlead-1" });
    prismaMock.marketingConvertedCustomer.create.mockResolvedValue({ id: "cc-1" });
    prismaMock.marketingDemoBooking.create.mockResolvedValue({ id: "demo-1" });
    prismaMock.marketingReportRequest.create.mockResolvedValue({ id: "rep-1" });
  });

  it("reads a global enabled flag as feature on", async () => {
    flagOn();
    await expect(isGrowthPersistEnabled()).resolves.toBe(true);
    expect(prismaMock.featureFlag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: GROWTH_PERSIST_FLAG } }),
    );
  });

  it("reads a global disabled flag as feature off", async () => {
    flagOff();
    await expect(isGrowthPersistEnabled()).resolves.toBe(false);
  });

  it("upsertLead does NOT touch Prisma when the flag is off (DataFile-only)", async () => {
    flagOff();
    await upsertLead({ name: "A", email: "a@x.co", source: "organic" }, scratch);
    expect(prismaMock.marketingLead.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("upsertLead mirrors a lead into Prisma keyed on legacyLeadId when the flag is on", async () => {
    flagOn();
    const lead = await upsertLead({ name: "B", email: "b@x.co", source: "organic" }, scratch);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.marketingLead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "b@x.co", legacyLeadId: lead!.id }),
      }),
    );
  });

  it("submitDemoRequest stores a Prisma demo booking when the flag is on", async () => {
    flagOn();
    await submitDemoRequest({ name: "C", email: "c@x.co" }, scratch);
    expect(prismaMock.marketingDemoBooking.create).toHaveBeenCalled();
  });

  it("submitReportRequest stores a Prisma report request when the flag is on", async () => {
    flagOn();
    await submitReportRequest(
      { name: "D", email: "d@x.co", propertySlug: "the-x" },
      "The X",
      scratch,
    );
    expect(prismaMock.marketingReportRequest.create).toHaveBeenCalled();
  });

  it("convertLead mirrors a converted customer + won stage when the flag is on", async () => {
    flagOn();
    const lead = await upsertLead({ name: "E", email: "e@x.co", source: "organic" }, scratch);
    await convertLead(lead!.id, { plan: "pro", byEmail: "sales@x.co" }, scratch);
    expect(prismaMock.marketingConvertedCustomer.create).toHaveBeenCalled();
    expect(prismaMock.marketingLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stage: "won" }) }),
    );
  });

  afterAll(async () => {
    await unlink(scratch).catch(() => undefined);
  });
});
