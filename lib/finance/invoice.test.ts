import { describe, expect, it } from "vitest";
import {
  assignInvoice,
  calculateAvailableLimit,
  calculateOutstandingBalance,
  closingForReferenceMonth,
  groupRemainingInstallmentsByInvoice,
} from "./invoice";

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

describe("R3 — closingForReferenceMonth is the inverse of assignInvoice", () => {
  it("round-trips for every purchase day in a month, for both roll directions", () => {
    for (let day = 1; day <= 28; day++) {
      for (const [closingDay, dueDay] of [[12, 20], [25, 5]] as const) {
        const purchaseDate = `2026-08-${String(day).padStart(2, "0")}`;
        const assignment = assignInvoice(purchaseDate, closingDay, dueDay);
        const { closingMonth } = closingForReferenceMonth(assignment.referenceMonth, closingDay, dueDay);
        expect(closingMonth).toEqual(assignment.closingMonth);
      }
    }
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

describe("R4 — anticipating a purchase's remaining installments", () => {
  it("groups unpaid installments by invoice, one entry per future month", () => {
    const result = groupRemainingInstallmentsByInvoice([
      { invoiceId: "aug", amountCents: 33_34, invoicePaid: false },
      { invoiceId: "sep", amountCents: 33_33, invoicePaid: false },
      { invoiceId: "oct", amountCents: 33_33, invoicePaid: false },
    ]);
    expect(result).toEqual([
      { invoiceId: "aug", amountCents: 33_34 },
      { invoiceId: "sep", amountCents: 33_33 },
      { invoiceId: "oct", amountCents: 33_33 },
    ]);
  });

  it("excludes installments whose invoice is already fully paid", () => {
    const result = groupRemainingInstallmentsByInvoice([
      { invoiceId: "aug", amountCents: 33_34, invoicePaid: true },
      { invoiceId: "sep", amountCents: 33_33, invoicePaid: false },
    ]);
    expect(result).toEqual([{ invoiceId: "sep", amountCents: 33_33 }]);
  });

  it("excludes installments with no invoice at all", () => {
    const result = groupRemainingInstallmentsByInvoice([{ invoiceId: null, amountCents: 33_34, invoicePaid: false }]);
    expect(result).toEqual([]);
  });

  it("sums multiple installments landing on the same invoice", () => {
    const result = groupRemainingInstallmentsByInvoice([
      { invoiceId: "aug", amountCents: 10_00, invoicePaid: false },
      { invoiceId: "aug", amountCents: 20_00, invoicePaid: false },
    ]);
    expect(result).toEqual([{ invoiceId: "aug", amountCents: 30_00 }]);
  });

  it("nothing left to anticipate once every installment's invoice is paid", () => {
    const result = groupRemainingInstallmentsByInvoice([{ invoiceId: "aug", amountCents: 33_34, invoicePaid: true }]);
    expect(result).toEqual([]);
  });
});
