import { formatInTimeZone } from "date-fns-tz";

const APP_TIMEZONE = "America/Sao_Paulo";

/**
 * "Today" as YYYY-MM-DD in the app's configured timezone — the one place
 * server code reads the wall clock. lib/finance/ functions always take
 * `today` as an explicit parameter instead, so they stay pure and
 * timezone-independent (CLAUDE.md § Dates).
 */
export function todayDateString(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Prisma's client requires a full ISO-8601 DateTime even for `@db.Date`
 * columns — a plain "YYYY-MM-DD" string throws a PrismaClientValidationError.
 * Every date reaching a Prisma write must pass through this first.
 */
export function toPrismaDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}
