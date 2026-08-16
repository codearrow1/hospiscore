import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isAdmin, listLeads, propertyUrl, setLeadStatus, filterLeads, leadsToCsv } from "./leads";
import { readData } from "./db";
import { submitDemoRequest } from "./demo";
import { submitReportRequest } from "./reportRequest";

let dirs: string[] = [];

async function tempTarget(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hs-leads-"));
  dirs.push(dir);
  return path.join(dir, "data.json");
}

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

describe("isAdmin", () => {
  it("matches allowed e-mails case-insensitively", () => {
    expect(isAdmin({ email: "Owner@Hospios.com" }, ["owner@hospios.com"])).toBe(true);
    expect(isAdmin({ email: "owner@hospios.com" }, ["owner@hospios.com"])).toBe(true);
    expect(isAdmin({ email: "guest@x.com" }, ["owner@hospios.com"])).toBe(false);
  });

  it("defaults to the configured admin list (empty in tests)", () => {
    expect(isAdmin({ email: "anyone@example.com" })).toBe(false);
  });
});

describe("listLeads", () => {
  it("merges demo and report requests into shaped rows", async () => {
    const target = await tempTarget();
    await submitDemoRequest(
      { name: "Marta", email: "m@harbor.com", company: "Coastal Group", propertyCount: 5 },
      target,
    );
    await submitReportRequest(
      { name: "Jonas", email: "jonas@lighthouse.se", propertySlug: "harbor-lights-inn" },
      "Harbor Lights Inn",
      target,
    );

    const leads = await listLeads(target);
    expect(leads.total).toBe(2);
    expect(leads.demo).toHaveLength(1);
    expect(leads.report).toHaveLength(1);

    expect(leads.demo[0]).toMatchObject({
      source: "demo",
      name: "Marta",
      email: "m@harbor.com",
      company: "Coastal Group",
      propertyCount: 5,
    });
    expect(leads.report[0]).toMatchObject({
      source: "report",
      name: "Jonas",
      email: "jonas@lighthouse.se",
      propertyName: "Harbor Lights Inn",
      propertySlug: "harbor-lights-inn",
    });
    expect(typeof leads.demo[0].id).toBe("string");
    expect(typeof leads.demo[0].createdAt).toBe("string");
  });

  it("returns empty snapshots when there are no leads", async () => {
    const target = await tempTarget();
    const leads = await listLeads(target);
    expect(leads.total).toBe(0);
    expect(leads.demo).toHaveLength(0);
    expect(leads.report).toHaveLength(0);
  });
});

describe("propertyUrl", () => {
  it("maps demo slugs to /properties and live place slugs to /property", () => {
    expect(propertyUrl("harbor-lights-inn")).toBe("/properties/harbor-lights-inn");
    expect(propertyUrl("place:ChIJabc")).toBe("/property/place%3AChIJabc");
  });
});

describe("lead status", () => {
  it("defaults captured leads to status new", async () => {
    const target = await tempTarget();
    await submitDemoRequest({ name: "Marta", email: "m@harbor.com" }, target);
    const leads = await listLeads(target);
    expect(leads.demo[0].status).toBe("new");
  });

  it("updates and persists the status of a demo lead", async () => {
    const target = await tempTarget();
    const record = await submitDemoRequest(
      { name: "Marta", email: "m@harbor.com", company: "Coastal Group" },
      target,
    );

    const updated = await setLeadStatus(record.id, "contacted", target);
    expect(updated).toMatchObject({ id: record.id, source: "demo", status: "contacted" });

    const doc = await readData(target);
    expect(doc.demoRequests[0].status).toBe("contacted");
  });

  it("updates and persists the status of a report lead", async () => {
    const target = await tempTarget();
    const record = await submitReportRequest(
      { name: "Jonas", email: "jonas@lighthouse.se", propertySlug: "harbor-lights-inn" },
      "Harbor Lights Inn",
      target,
    );

    const updated = await setLeadStatus(record.id, "won", target);
    expect(updated).toMatchObject({ id: record.id, source: "report", status: "won" });

    const doc = await readData(target);
    expect(doc.reportRequests[0].status).toBe("won");
  });

  it("returns null for an unknown lead and writes nothing", async () => {
    const target = await tempTarget();
    const updated = await setLeadStatus("no-such-id", "closed", target);
    expect(updated).toBeNull();
    const leads = await listLeads(target);
    expect(leads.total).toBe(0);
  });

  it("rejects an invalid status", async () => {
    const target = await tempTarget();
    const record = await submitDemoRequest({ name: "Marta", email: "m@harbor.com" }, target);
    await expect(
      setLeadStatus(record.id, "pipeline" as never, target),
    ).rejects.toThrow("Invalid lead status");
  });

  it("only rewrites the matched lead", async () => {
    const target = await tempTarget();
    const a = await submitDemoRequest({ name: "A", email: "a@x.com" }, target);
    const b = await submitDemoRequest({ name: "B", email: "b@x.com" }, target);

    await setLeadStatus(a.id, "won", target);

    const leads = await listLeads(target);
    expect(leads.demo.find((r) => r.id === a.id)?.status).toBe("won");
    expect(leads.demo.find((r) => r.id === b.id)?.status).toBe("new");
  });
});

describe("filterLeads", () => {
  it("applies source and status filters independently", async () => {
    const target = await tempTarget();
    const demo = await submitDemoRequest({ name: "A", email: "a@x.com" }, target);
    await setLeadStatus(demo.id, "contacted", target);
    await submitDemoRequest({ name: "B", email: "b@x.com" }, target);
    const report = await submitReportRequest(
      { name: "C", email: "c@x.com", propertySlug: "harbor-lights-inn" },
      "Harbor Lights Inn",
      target,
    );
    await setLeadStatus(report.id, "won", target);

    const snap = await listLeads(target);

    expect(filterLeads(snap, "all", "all").demo).toHaveLength(2);
    expect(filterLeads(snap, "all", "all").report).toHaveLength(1);

    const contacted = filterLeads(snap, "all", "contacted");
    expect(contacted.demo.map((r) => r.name)).toEqual(["A"]);
    expect(contacted.report).toHaveLength(0);

    const demoWon = filterLeads(snap, "demo", "won");
    expect(demoWon.demo).toHaveLength(0);
    expect(demoWon.report).toHaveLength(0);

    const reportAll = filterLeads(snap, "report", "all");
    expect(reportAll.demo).toHaveLength(0);
    expect(reportAll.report).toHaveLength(1);
  });
});

describe("leadsToCsv", () => {
  it("writes a header row, BOM and CRLF rows with quoted/escaped fields", async () => {
    const target = await tempTarget();
    await submitDemoRequest(
      { name: 'Marta "M" Alvarez', email: "m@harbor.com", company: "Coastal Group", propertyCount: 5 },
      target,
    );
    await submitReportRequest(
      { name: "Jonas Berg", email: "jonas@lighthouse.se", propertySlug: "harbor-lights-inn" },
      "Harbor Lights Inn",
      target,
    );
    const snap = await listLeads(target);

    const csv = leadsToCsv([...snap.demo, ...snap.report]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("source,status,name,email,phone,propertyName,propertySlug,company,propertyCount,message,createdAt");
    expect(csv).toContain('"demo","new","Marta ""M"" Alvarez","m@harbor.com",""');
    expect(csv).toContain('"report","new","Jonas Berg","jonas@lighthouse.se","","Harbor Lights Inn","harbor-lights-inn"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("returns headers only for an empty list", () => {
    const csv = leadsToCsv([]);
    expect(csv).toContain("source,status,name");
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1);
  });
});
