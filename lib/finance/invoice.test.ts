import { describe, expect, it } from "vitest";
import { assignInvoice, calculateAvailableLimit, calculateOutstandingBalance } from "./invoice";

describe("R3 — invoice assignment", () => {
  it("purchase on 10/08 with closingDay=12 lands on the August invoice, due 20/08", () => {
    const result = assignInvoice("2026-08-10", 12, 20);
    expect(result.closingMonth).toEqual({ year: 2026, month: 8 });
    expect(result.referenceMonth).toEqual({ year: 2026, month: 8 });
    expect(result.dueDate).toBe("2026-08-20");
  });

  it("purchase on 13/08 with closingDay=12 lands on the September invoice", () => {
    const result = assignInvoice("2026-08-13", 12, 20);
    expect(result.closingMonth).toEqual({ year: 2026, month: 9 });
    expect(result.referenceMonth).toEqual({ year: 2026, month: 9 });
  });

  it("two cards with different closingDays send the same purchase date to different invoices", () => {
    const cardA = assignInvoice("2026-08-13", 15, 25);
    const cardB = assignInvoice("2026-08-13", 10, 20);
    expect(cardA.closingMonth).toEqual({ year: 2026, month: 8 });
    expect(cardB.closingMonth).toEqual({ year: 2026, month: 9 });
  });

  it("dueDay < closingDay rolls the due date (and referenceMonth) to the month after closing", () => {
    const result = assignInvoice("2026-08-10", 25, 5);
    expect(result.closingMonth).toEqual({ year: 2026, month: 8 });
    expect(result.referenceMonth).toEqual({ year: 2026, month: 9 });
    expect(result.dueDate).toBe("2026-09-05");
  });

  it("rolls the year over at December", () => {
    const result = assignInvoice("2026-12-20", 12, 5);
    expect(result.closingMonth).toEqual({ year: 2027, month: 1 });
  });
});

describe("R3 — available card limit", () => {
  it("deducts unpaid invoice totals (including future installments) from the limit", () => {
    const result = calculateAvailableLimit({ limitCents: 500_000, unpaidInvoiceTotalCents: 320_000 });
    expect(result.availableCents).toBe(180_000);
    expect(result.utilizationPercent).toBeCloseTo(64, 5);
  });
});

describe("R3 — partial payment leaves a visible outstanding balance", () => {
  it("subtracts what was paid from the invoice total", () => {
    expect(calculateOutstandingBalance(1_000_00, 600_00)).toBe(400_00);
  });

  it("never goes negative", () => {
    expect(calculateOutstandingBalance(1_000_00, 1_500_00)).toBe(0);
  });

  it("an unpaid invoice is outstanding for its full total", () => {
    expect(calculateOutstandingBalance(1_000_00, null)).toBe(1_000_00);
  });
});
