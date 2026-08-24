import { describe, expect, it } from "vitest";
import {
  formatBps,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPct,
  formatRelative,
} from "./format";

describe("formatMoney", () => {
  it("formats minor units with the record currency", () => {
    expect(formatMoney(123456, "USD")).toMatch(/1,234\.56/);
    expect(formatMoney(123456, "eur")).toMatch(/1\.234,56|1,234\.56/);
  });

  it("never guesses a currency", () => {
    expect(formatMoney(5000)).toBe("—");
    expect(formatMoney(5000, null)).toBe("—");
    expect(formatMoney(5000, "dollars")).toBe("—");
  });

  it("handles missing and invalid amounts", () => {
    expect(formatMoney(null, "USD")).toBe("—");
    expect(formatMoney(undefined, "USD")).toBe("—");
    expect(formatMoney(Number.NaN, "USD")).toBe("—");
    expect(formatMoney(0, "USD")).toMatch(/0\.00/);
  });
});

describe("formatBps / formatPct / formatNumber", () => {
  it("converts basis points", () => {
    expect(formatBps(1500)).toBe("15%");
    expect(formatBps(1250, 2)).toBe("12.50%");
    expect(formatBps(null)).toBe("—");
  });

  it("formats percents from fraction or raw", () => {
    expect(formatPct(0.425, { digits: 1 })).toBe("42.5%");
    expect(formatPct(42, { asFraction: false })).toBe("42%");
    expect(formatPct(null)).toBe("—");
  });

  it("formats numbers", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatNumber(undefined)).toBe("—");
  });
});

describe("dates", () => {
  const ts = "2026-08-24T15:05:00Z";

  it("formats dates and date-times", () => {
    expect(formatDate(ts)).toMatch(/Aug 24, 2026/);
    expect(formatDateTime(ts, { timeZone: "UTC" })).toMatch(/Aug 24, 2026/);
    expect(formatDateTime(ts, { timeZone: "UTC" })).toMatch(/3:05/);
  });

  it("is timezone-aware", () => {
    const utc = formatDateTime(ts, { timeZone: "UTC" });
    const ist = formatDateTime(ts, { timeZone: "Asia/Kolkata" });
    expect(utc).not.toEqual(ist);
  });

  it("returns an em dash for missing or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-08-24T12:00:00Z");

  it("describes past and future offsets", () => {
    expect(formatRelative("2026-08-24T11:30:00Z", now)).toMatch(/minute/);
    expect(formatRelative("2026-08-26T12:00:00Z", now)).toMatch(/in 2 days/);
    expect(formatRelative("2026-08-22T12:00:00Z", now)).toMatch(/2 days ago/);
  });

  it("handles invalid input", () => {
    expect(formatRelative(null, now)).toBe("—");
  });
});
