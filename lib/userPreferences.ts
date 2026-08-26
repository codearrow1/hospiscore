import { prisma } from "@/lib/prisma";

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export const DATE_FORMATS = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (e.g. 2026-08-26)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (e.g. 26/08/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (e.g. 08/26/2026)" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY (e.g. 26.08.2026)" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY (e.g. 26 Aug 2026)" },
] as const;

export interface UserPreferences {
  email: string;
  timezone: string;
  dateFormat: string;
}

const DEFAULT_PREFS: Omit<UserPreferences, "email"> = {
  timezone: "UTC",
  dateFormat: "YYYY-MM-DD",
};

export async function getUserPreferences(email: string): Promise<UserPreferences> {
  const row = await prisma.userPreference.findUnique({ where: { email } });
  if (!row) return { email, ...DEFAULT_PREFS };
  return { email, timezone: row.timezone, dateFormat: row.dateFormat };
}

export async function updateUserPreferences(
  email: string,
  patch: { timezone?: string; dateFormat?: string },
): Promise<UserPreferences> {
  if (patch.timezone && !TIMEZONES.includes(patch.timezone as never)) {
    throw new Error("Invalid timezone");
  }
  if (patch.dateFormat && !DATE_FORMATS.some((f) => f.value === patch.dateFormat)) {
    throw new Error("Invalid date format");
  }
  const data: { timezone?: string; dateFormat?: string } = {};
  if (patch.timezone) data.timezone = patch.timezone;
  if (patch.dateFormat) data.dateFormat = patch.dateFormat;

  const row = await prisma.userPreference.upsert({
    where: { email },
    update: data,
    create: { email, timezone: data.timezone ?? DEFAULT_PREFS.timezone, dateFormat: data.dateFormat ?? DEFAULT_PREFS.dateFormat },
  });
  return { email, timezone: row.timezone, dateFormat: row.dateFormat };
}
