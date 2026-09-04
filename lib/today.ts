import { formatInTimeZone } from "date-fns-tz";

const APP_TIMEZONE = "America/Sao_Paulo";

/**
 * "Today" as YYYY-MM-DD in the app's fixed timezone. Safe to import from a
 * Server Component/Action or a Client Component alike — unlike
 * `new Date().toISOString().slice(0, 10)`, which always normalizes to UTC
 * and so silently returns *tomorrow's* date from ~21h onward in
 * America/Sao_Paulo (UTC-3), any time a form defaults a date field to
 * "today" (CLAUDE.md § Dates: no timezone-dependent competence behavior).
 */
export function todayDateString(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}
