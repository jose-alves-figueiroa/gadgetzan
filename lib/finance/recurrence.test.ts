import { describe, expect, it } from "vitest";
import { generateOccurrences, isOccurrencePending, nextOccurrenceDate, occurrenceTarget } from "./recurrence";
import type { RecurrenceRuleInput } from "./recurrence";

function monthlyRule(overrides: Partial<RecurrenceRuleInput> = {}): RecurrenceRuleInput {
  return {
    frequency: "MONTHLY",
    dayOfMonth: 5,
    startDate: "2026-01-01",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("R6 — monthly occurrences truncate short months", () => {
  it("day 31 generates 28/02 in a non-leap year", () => {
    const dates = generateOccurrences(monthlyRule({ dayOfMonth: 31 }), "2027-02-01", "2027-02-28");
    expect(dates).toEqual(["2027-02-28"]);
  });

  it("day 31 generates 29/02 in a leap year", () => {
    const dates = generateOccurrences(monthlyRule({ dayOfMonth: 31 }), "2028-02-01", "2028-02-29");
    expect(dates).toEqual(["2028-02-29"]);
  });

  it("generates one occurrence per month across a range", () => {
    const dates = generateOccurrences(monthlyRule(), "2026-08-01", "2026-10-31");
    expect(dates).toEqual(["2026-08-05", "2026-09-05", "2026-10-05"]);
  });
});

describe("R6 — status", () => {
  it("PAUSED generates no occurrences", () => {
    expect(generateOccurrences(monthlyRule({ status: "PAUSED" }), "2026-08-01", "2026-12-31")).toEqual([]);
  });

  it("ENDED (with a past endDate) generates no future occurrences", () => {
    const rule = monthlyRule({ status: "ACTIVE", endDate: "2026-06-30" });
    expect(generateOccurrences(rule, "2026-08-01", "2026-12-31")).toEqual([]);
  });

  it("an endDate mid-range stops the series exactly there", () => {
    const rule = monthlyRule({ endDate: "2026-09-10" });
    expect(generateOccurrences(rule, "2026-08-01", "2026-10-31")).toEqual(["2026-08-05", "2026-09-05"]);
  });
});

describe("R6 — pending occurrences", () => {
  it("a past occurrence with no transaction is pending", () => {
    expect(isOccurrencePending("2026-08-05", "2026-08-28", false)).toBe(true);
  });

  it("a past occurrence with a matching transaction is not pending", () => {
    expect(isOccurrencePending("2026-08-05", "2026-08-28", true)).toBe(false);
  });

  it("a future occurrence is never pending", () => {
    expect(isOccurrencePending("2026-09-05", "2026-08-28", false)).toBe(false);
  });
});

describe("R6 — method=CARD lands on the invoice", () => {
  it("CARD targets the invoice, ACCOUNT targets the account", () => {
    expect(occurrenceTarget("CARD")).toBe("INVOICE");
    expect(occurrenceTarget("ACCOUNT")).toBe("ACCOUNT");
  });
});

describe("R6 — confirmedThroughDate suppresses already-fulfilled occurrences", () => {
  it("excludes an occurrence on or before confirmedThroughDate", () => {
    const rule = monthlyRule({ confirmedThroughDate: "2026-09-05" });
    expect(generateOccurrences(rule, "2026-08-01", "2026-10-31")).toEqual(["2026-10-05"]);
  });

  it("keeps occurrences strictly after confirmedThroughDate", () => {
    const rule = monthlyRule({ confirmedThroughDate: "2026-09-04" });
    expect(generateOccurrences(rule, "2026-08-01", "2026-10-31")).toEqual(["2026-09-05", "2026-10-05"]);
  });
});

describe("R6 — nextOccurrenceDate (anticipating a recurrence, 'confirmar agora')", () => {
  it("returns the first occurrence when nothing was confirmed yet", () => {
    expect(nextOccurrenceDate(monthlyRule())).toBe("2026-01-05");
  });

  it("skips past confirmedThroughDate to the following occurrence", () => {
    const rule = monthlyRule({ confirmedThroughDate: "2026-09-05" });
    expect(nextOccurrenceDate(rule)).toBe("2026-10-05");
  });

  it("returns null once the rule is exhausted (endDate before the next slot)", () => {
    const rule = monthlyRule({ confirmedThroughDate: "2026-09-05", endDate: "2026-09-05" });
    expect(nextOccurrenceDate(rule)).toBeNull();
  });

  it("returns null for a PAUSED rule", () => {
    expect(nextOccurrenceDate(monthlyRule({ status: "PAUSED" }))).toBeNull();
  });

  it("works for YEARLY, skipping to next year once this year's is confirmed", () => {
    const rule: RecurrenceRuleInput = {
      frequency: "YEARLY",
      dayOfMonth: 15,
      monthOfYear: 12,
      startDate: "2025-01-01",
      status: "ACTIVE",
      confirmedThroughDate: "2026-12-15",
    };
    expect(nextOccurrenceDate(rule)).toBe("2027-12-15");
  });
});

describe("R6 — yearly and weekly", () => {
  it("YEARLY generates one occurrence per year in the given month", () => {
    const rule: RecurrenceRuleInput = {
      frequency: "YEARLY",
      dayOfMonth: 15,
      monthOfYear: 12,
      startDate: "2025-01-01",
      status: "ACTIVE",
    };
    expect(generateOccurrences(rule, "2026-01-01", "2027-12-31")).toEqual(["2026-12-15", "2027-12-15"]);
  });

  it("WEEKLY generates one occurrence per matching weekday", () => {
    const rule: RecurrenceRuleInput = {
      frequency: "WEEKLY",
      weekday: 1, // Monday
      startDate: "2026-08-01",
      status: "ACTIVE",
    };
    const dates = generateOccurrences(rule, "2026-08-01", "2026-08-31");
    dates.forEach((date) => {
      expect(new Date(`${date}T00:00:00Z`).getUTCDay()).toBe(1);
    });
    expect(dates.length).toBe(5);
  });
});
