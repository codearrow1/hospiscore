import { describe, it, expect, vi, beforeEach } from "vitest";
import { TIMEZONES, DATE_FORMATS } from "./userPreferences";

const mockFindUnique = vi.fn().mockResolvedValue(null);
const mockUpsert = vi.fn().mockResolvedValue({ email: "test@example.com", timezone: "UTC", dateFormat: "YYYY-MM-DD" });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userPreference: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

describe("userPreferences constants", () => {
  it("TIMEZONES includes major regions", () => {
    expect(TIMEZONES).toContain("UTC");
    expect(TIMEZONES).toContain("America/New_York");
    expect(TIMEZONES).toContain("Asia/Kolkata");
    expect(TIMEZONES).toContain("Europe/London");
    expect(TIMEZONES.length).toBeGreaterThanOrEqual(15);
  });

  it("DATE_FORMATS has 5 formats", () => {
    expect(DATE_FORMATS).toHaveLength(5);
    for (const f of DATE_FORMATS) {
      expect(f.value).toBeTruthy();
      expect(f.label).toBeTruthy();
    }
  });
});

describe("userPreferences — getUserPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns defaults when no row exists", async () => {
    const { getUserPreferences } = await import("./userPreferences");
    mockFindUnique.mockResolvedValueOnce(null);
    const prefs = await getUserPreferences("new@example.com");
    expect(prefs.timezone).toBe("UTC");
    expect(prefs.dateFormat).toBe("YYYY-MM-DD");
    expect(prefs.email).toBe("new@example.com");
  });

  it("returns DB values when row exists", async () => {
    const { getUserPreferences } = await import("./userPreferences");
    mockFindUnique.mockResolvedValueOnce({ email: "u@x.com", timezone: "Asia/Tokyo", dateFormat: "DD/MM/YYYY" });
    const prefs = await getUserPreferences("u@x.com");
    expect(prefs.timezone).toBe("Asia/Tokyo");
    expect(prefs.dateFormat).toBe("DD/MM/YYYY");
  });
});

describe("userPreferences — updateUserPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts timezone", async () => {
    const { updateUserPreferences } = await import("./userPreferences");
    mockUpsert.mockResolvedValueOnce({ email: "u@x.com", timezone: "Europe/Paris", dateFormat: "YYYY-MM-DD" });
    const prefs = await updateUserPreferences("u@x.com", { timezone: "Europe/Paris" });
    expect(prefs.timezone).toBe("Europe/Paris");
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("rejects invalid timezone", async () => {
    const { updateUserPreferences } = await import("./userPreferences");
    await expect(updateUserPreferences("u@x.com", { timezone: "Invalid/Zone" })).rejects.toThrow("Invalid timezone");
  });

  it("rejects invalid date format", async () => {
    const { updateUserPreferences } = await import("./userPreferences");
    await expect(updateUserPreferences("u@x.com", { dateFormat: "not-a-format" })).rejects.toThrow("Invalid date format");
  });
});
