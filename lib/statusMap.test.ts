import { describe, expect, it } from "vitest";
import { humanizeStatus, statusMeta } from "./statusMap";

describe("statusMeta", () => {
  it("maps known domain statuses to semantic tones", () => {
    expect(statusMeta("invoice", "paid")).toMatchObject({ tone: "success" });
    expect(statusMeta("invoice", "overdue")).toMatchObject({ tone: "danger" });
    expect(statusMeta("subscription", "past_due").label).toBe("Past due");
    expect(statusMeta("payment", "refunded").tone).toBe("accent");
    expect(statusMeta("sla", "breached").tone).toBe("danger");
    expect(statusMeta("featureFlag", "on").tone).toBe("success");
    expect(statusMeta("featureFlag", "off").tone).toBe("neutral");
  });

  it("is case-insensitive", () => {
    expect(statusMeta("ticket", "IN_PROGRESS").tone).toBe("warning");
  });

  it("falls back to a humanized neutral badge for unknown values", () => {
    expect(statusMeta("organization", "onboarding")).toEqual({
      label: "Onboarding",
      tone: "neutral",
    });
    expect(statusMeta("invoice", null).label).toBe("Unknown");
  });
});

describe("humanizeStatus", () => {
  it("converts machine keys to words", () => {
    expect(humanizeStatus("past_due")).toBe("Past Due");
    expect(humanizeStatus("in_progress")).toBe("In Progress");
  });
});
