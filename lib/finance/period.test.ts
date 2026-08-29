import { describe, expect, it } from "vitest";
import { addDays, getFinancialMonth, isValidMonthStartDay, monthLabel } from "./period";

describe("getFinancialMonth (R5)", () => {
  it("a 04/09 transaction belongs to the month labeled August when monthStartDay=5", () => {
    const month = getFinancialMonth("2026-09-04", 5);
    expect(month.label).toBe("Agosto 2026");
    expect(month.start).toBe("2026-08-05");
    expect(month.end).toBe("2026-09-05");
  });

  it("a 05/09 transaction belongs to September when monthStartDay=5", () => {
    const month = getFinancialMonth("2026-09-05", 5);
    expect(month.label).toBe("Setembro 2026");
  });

  it("rolls over the year at December→January", () => {
    const month = getFinancialMonth("2026-01-03", 5);
    expect(month.label).toBe("Dezembro 2025");
    expect(month.start).toBe("2025-12-05");
    expect(month.end).toBe("2026-01-05");
  });

  it("monthStartDay=1 matches the plain calendar month", () => {
    const month = getFinancialMonth("2026-08-15", 1);
    expect(month.label).toBe("Agosto 2026");
    expect(month.start).toBe("2026-08-01");
    expect(month.end).toBe("2026-09-01");
  });
});

describe("isValidMonthStartDay (R5)", () => {
  it("rejects 31 — max is 28", () => {
    expect(isValidMonthStartDay(31)).toBe(false);
  });

  it("accepts 1..28", () => {
    expect(isValidMonthStartDay(1)).toBe(true);
    expect(isValidMonthStartDay(28)).toBe(true);
  });

  it("rejects 0 and negative values", () => {
    expect(isValidMonthStartDay(0)).toBe(false);
    expect(isValidMonthStartDay(-1)).toBe(false);
  });
});

describe("addDays", () => {
  it("advances across a month boundary", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
  });

  it("goes backward across a year boundary", () => {
    expect(addDays("2026-01-02", -5)).toBe("2025-12-28");
  });
});

describe("monthLabel", () => {
  it("formats a calendar month independent of monthStartDay", () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe("Setembro 2026");
  });
});
