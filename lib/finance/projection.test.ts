import { describe, expect, it } from "vitest";
import {
  calculateProjectedBalanceSeries,
  calculateVariableProjection,
  classifyTransactionConfidence,
  groupByConfidence,
  sumRecurringContributions,
} from "./projection";

describe("R7 — transaction confidence", () => {
  it("a transaction dated today or earlier is REALIZED", () => {
    expect(classifyTransactionConfidence("2026-08-28", "2026-08-28")).toBe("REALIZED");
    expect(classifyTransactionConfidence("2026-08-01", "2026-08-28")).toBe("REALIZED");
  });

  it("a future-dated transaction (e.g. a future installment) is CONFIRMED", () => {
    expect(classifyTransactionConfidence("2026-09-15", "2026-08-28")).toBe("CONFIRMED");
  });

  it("groupByConfidence never blends levels into one number", () => {
    const totals = groupByConfidence([
      { confidence: "REALIZED", amountCents: 1000 },
      { confidence: "CONFIRMED", amountCents: 2000 },
      { confidence: "PROJECTED", amountCents: 3000 },
    ]);
    expect(totals).toEqual({ REALIZED: 1000, CONFIRMED: 2000, RECURRING: 0, PROJECTED: 3000 });
  });
});

describe("R8 — variable spend projection", () => {
  it("with 0–2 closed months, returns null (no projection)", () => {
    expect(calculateVariableProjection([], 3)).toBeNull();
    expect(calculateVariableProjection([1000, 2000], 3)).toBeNull();
  });

  it("with 3 closed months, projects the arithmetic average", () => {
    expect(calculateVariableProjection([1000, 2000, 3000], 3)).toBe(2000);
  });

  it("uses only the most recent `lookback` months once there's more history", () => {
    expect(calculateVariableProjection([100, 1000, 2000, 3000], 3)).toBe(2000);
  });
});

describe("R2 — recurring investment contributions", () => {
  it("sums only occurrences landing inside [start, end)", () => {
    const occurrences = [
      { date: "2026-07-31", amountCents: 10_000 },
      { date: "2026-08-01", amountCents: 20_000 },
      { date: "2026-08-15", amountCents: 30_000 },
      { date: "2026-08-31", amountCents: 40_000 },
      { date: "2026-09-01", amountCents: 50_000 },
    ];
    expect(sumRecurringContributions(occurrences, "2026-08-01", "2026-09-01")).toBe(90_000);
  });

  it("returns 0 with no occurrences in range", () => {
    expect(sumRecurringContributions([], "2026-08-01", "2026-09-01")).toBe(0);
    expect(
      sumRecurringContributions([{ date: "2026-06-01", amountCents: 10_000 }], "2026-08-01", "2026-09-01")
    ).toBe(0);
  });
});

describe("R8 — projected balance series", () => {
  it("projectedBalance[current month] equals the balance available today", () => {
    const series = calculateProjectedBalanceSeries(500_000, [
      { expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
    ]);
    expect(series[0]).toBe(500_000);
  });

  it("applies the recurrence formula month over month", () => {
    const series = calculateProjectedBalanceSeries(500_000, [
      { expectedIncomeCents: 300_000, expectedAccountExpensesCents: 150_000, invoicesDueCents: 50_000, scheduledContributionsCents: 20_000 },
      { expectedIncomeCents: 300_000, expectedAccountExpensesCents: 150_000, invoicesDueCents: 50_000, scheduledContributionsCents: 20_000 },
    ]);
    expect(series).toEqual([500_000, 580_000, 660_000]);
  });

  it("registering a 15,000 recurring salary raises expected income for every future month", () => {
    const months = [
      { expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
      { expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
    ];
    const before = calculateProjectedBalanceSeries(0, months);
    const withSalary = months.map((m) => ({ ...m, expectedIncomeCents: m.expectedIncomeCents + 1_500_000 }));
    const after = calculateProjectedBalanceSeries(0, withSalary);

    expect(after[1] - before[1]).toBe(1_500_000);
    expect(after[2] - before[2]).toBe(3_000_000);
  });
});
