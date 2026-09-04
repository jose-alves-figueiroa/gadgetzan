export { todayDateString } from "@/lib/today";

/**
 * Prisma's client requires a full ISO-8601 DateTime even for `@db.Date`
 * columns — a plain "YYYY-MM-DD" string throws a PrismaClientValidationError.
 * Every date reaching a Prisma write must pass through this first.
 */
export function toPrismaDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}
