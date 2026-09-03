import { prisma } from "@/lib/prisma";
export { TIMEZONES, DATE_FORMATS, type UserPreferences } from "./userPreferences.constants";

import { TIMEZONES, DATE_FORMATS, type UserPreferences } from "./userPreferences.constants";

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
