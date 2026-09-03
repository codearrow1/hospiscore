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
