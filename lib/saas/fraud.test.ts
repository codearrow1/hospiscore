import { describe, it, expect } from "vitest";
import { canTransitionFraud, FRAUD_STATUSES, FRAUD_RESOLUTIONS } from "./fraud";

describe("fraud case transitions", () => {
  it("has valid status set", () => {
    expect(FRAUD_STATUSES).toContain("open");
    expect(FRAUD_STATUSES).toContain("investigating");
    expect(FRAUD_STATUSES).toContain("resolved");
    expect(FRAUD_STATUSES).toContain("dismissed");
    expect(FRAUD_STATUSES).not.toContain("bogus");
  });

  it("has valid resolution set", () => {
    expect(FRAUD_RESOLUTIONS).toContain("no_action");
    expect(FRAUD_RESOLUTIONS).toContain("warning");
    expect(FRAUD_RESOLUTIONS).toContain("commission_hold");
    expect(FRAUD_RESOLUTIONS).toContain("account_suspend");
    expect(FRAUD_RESOLUTIONS).toContain("account_terminate");
  });

  it("enforces allowed transitions", () => {
    expect(canTransitionFraud("open", "investigating")).toBe(true);
    expect(canTransitionFraud("open", "resolved")).toBe(true);
    expect(canTransitionFraud("open", "dismissed")).toBe(true);
    expect(canTransitionFraud("open", "open")).toBe(false);
    expect(canTransitionFraud("investigating", "resolved")).toBe(true);
    expect(canTransitionFraud("investigating", "dismissed")).toBe(true);
    expect(canTransitionFraud("investigating", "open")).toBe(false);
    expect(canTransitionFraud("resolved", "open")).toBe(false);
    expect(canTransitionFraud("dismissed", "open")).toBe(false);
  });
});
