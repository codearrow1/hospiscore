import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateReportInput, submitReportRequest } from "./reportRequest";
import { buildReportEmail } from "./reportEmail";
import { readData } from "./db";
import { findProperty } from "./data";
import { computeScore } from "./scoring";
import { buildReport } from "./report";

let dirs: string[] = [];

async function tempTarget(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hs-report-"));
  dirs.push(dir);
  return path.join(dir, "data.json");
}

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

describe("validateReportInput", () => {
  it("accepts a valid request", () => {
    expect(
      validateReportInput({
        name: "Marta Alvarez",
        email: "marta@harborlights.com",
        propertySlug: "the-royal-sandpiper",
      }),
    ).toEqual({ ok: true });
  });

  it("accepts an optional phone number", () => {
    expect(
      validateReportInput({
        name: "Marta Alvarez",
        email: "marta@harborlights.com",
        phone: "+1 (555) 123-4567",
        propertySlug: "the-royal-sandpiper",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects a phone that is too short", () => {
    expect(
      validateReportInput({
        name: "Marta Alvarez",
        email: "marta@harborlights.com",
        phone: "123",
        propertySlug: "the-royal-sandpiper",
      }),
    ).toMatchObject({ ok: false, error: "Enter a valid phone number" });
  });

  it("rejects a missing name", () => {
    expect(
      validateReportInput({ name: "", email: "m@x.com", propertySlug: "the-royal-sandpiper" }),
    ).toMatchObject({ ok: false, error: "Name is required" });
  });

  it("rejects a malformed email", () => {
    expect(
      validateReportInput({ name: "Marta", email: "not-an-email", propertySlug: "x" }),
    ).toMatchObject({ ok: false, error: "Enter a valid email address" });
  });

  it("rejects a missing property slug", () => {
    expect(
      validateReportInput({ name: "Marta", email: "m@x.com", propertySlug: "" }),
    ).toMatchObject({ ok: false, error: "A property is required" });
  });
});

describe("submitReportRequest", () => {
  it("persists a lead with id, lowercased email, property and timestamp", async () => {
    const target = await tempTarget();
    const record = await submitReportRequest(
      {
        name: "  Marta Alvarez  ",
        email: "Marta@HarborLights.com",
        propertySlug: "the-royal-sandpiper",
      },
      "The Royal Sandpiper",
      target,
    );
    expect(validateReportInput({ name: record.name, email: record.email, propertySlug: record.propertySlug })).toEqual({
      ok: true,
    });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.email).toBe("marta@harborlights.com");
    expect(record.name).toBe("Marta Alvarez");
    expect(record.propertySlug).toBe("the-royal-sandpiper");
    expect(record.propertyName).toBe("The Royal Sandpiper");
    expect(typeof record.createdAt).toBe("string");

    const doc = await readData(target);
    expect(doc.reportRequests).toHaveLength(1);
    expect(doc.reportRequests[0].id).toBe(record.id);
  });

  it("persists the phone number when provided", async () => {
    const target = await tempTarget();
    const record = await submitReportRequest(
      {
        name: "Marta Alvarez",
        email: "marta@harborlights.com",
        phone: "+1 (555) 123-4567",
        propertySlug: "the-royal-sandpiper",
      },
      "The Royal Sandpiper",
      target,
    );
    expect(record.phone).toBe("+1 (555) 123-4567");
    const doc = await readData(target);
    expect(doc.reportRequests[0].phone).toBe("+1 (555) 123-4567");
  });

  it("omits the phone field when left blank", async () => {
    const target = await tempTarget();
    const record = await submitReportRequest(
      { name: "A", email: "a@x.com", phone: "", propertySlug: "s1" },
      "P1",
      target,
    );
    expect(record.phone).toBeUndefined();
  });

  it("accumulates multiple requests without touching demo requests", async () => {
    const target = await tempTarget();
    await submitReportRequest(
      { name: "A", email: "a@x.com", propertySlug: "s1" },
      "P1",
      target,
    );
    await submitReportRequest(
      { name: "B", email: "b@x.com", propertySlug: "s2" },
      "P2",
      target,
    );
    const doc = await readData(target);
    expect(doc.reportRequests).toHaveLength(2);
    expect(doc.demoRequests).toHaveLength(0);
  });

  it("throws on invalid input and stores nothing", async () => {
    const target = await tempTarget();
    await expect(
      submitReportRequest({ name: "A", email: "bad-email", propertySlug: "s1" }, "P1", target),
    ).rejects.toThrow("valid email");
    const doc = await readData(target);
    expect(doc.reportRequests).toHaveLength(0);
  });
});

describe("buildReportEmail", () => {
  it("renders a complete report e-mail with escaped content", () => {
    const prop = findProperty("the-royal-sandpiper");
    if (!prop) throw new Error("test property missing");
    const result = computeScore(prop.signals);
    const report = buildReport(prop.name, prop.signals);
    const email = buildReportEmail({ property: prop, result, report });

    expect(email.subject).toContain(prop.name);
    expect(email.subject).toContain(String(result.overall));
    expect(email.subject).toContain(result.grade);
    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain(prop.name);
    expect(email.html).toContain(prop.city);
    expect(email.html).toContain(String(result.overall));
    expect(email.html).toContain(report.headline);
    expect(email.html).toContain("/properties/the-royal-sandpiper");
    expect(email.html).toContain("View the live report");
    expect(email.html).not.toContain("</table></table>");
  });

  it("points live place slugs at the /property/ route", () => {
    const prop = findProperty("the-royal-sandpiper");
    if (!prop) throw new Error("test property missing");
    const live = { ...prop, slug: "place:ChIJabc123" };
    const result = computeScore(live.signals);
    const report = buildReport(live.name, live.signals);
    const email = buildReportEmail({ property: live, result, report });
    expect(email.html).toContain("/property/place%3AChIJabc123");
  });
});
