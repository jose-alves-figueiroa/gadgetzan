import { describe, expect, it } from "vitest";
import { calculateLimitUtilization, calculateTotalMonthSpend } from "./limits";
import type { FinanceCategory, FinanceTransaction } from "./types";

describe("limit utilization", () => {
  it("a limit at 85% with warnAtPercent=80 is a warning", () => {
    const result = calculateLimitUtilization(850_00, 1_000_00, 80);
    expect(result.percent).toBeCloseTo(85, 5);
    expect(result.status).toBe("warning");
  });

  it("an exceeded limit is flagged exceeded", () => {
    const result = calculateLimitUtilization(1_100_00, 1_000_00, 80);
    expect(result.status).toBe("exceeded");
  });

  it("below the warn threshold is ok", () => {
    const result = calculateLimitUtilization(500_00, 1_000_00, 80);
    expect(result.status).toBe("ok");
  });
});

describe("D4 — total-month limit excludes commitments by default", () => {
  const categories: FinanceCategory[] = [
    { id: "housing", nature: "FIXED" },
    { id: "tithe", nature: "COMMITMENT" },
  ];
  const transactions: FinanceTransaction[] = [
    { id: "t1", kind: "EXPENSE", amountCents: 100_000, competenceDate: "2026-08-05", categoryId: "housing" },
    { id: "t2", kind: "EXPENSE", amountCents: 50_000, competenceDate: "2026-08-05", categoryId: "tithe" },
  ];

  it("excludes COMMITMENT spend by default", () => {
    expect(calculateTotalMonthSpend(transactions, categories, false)).toBe(100_000);
  });

  it("includes COMMITMENT spend when the toggle is on", () => {
    expect(calculateTotalMonthSpend(transactions, categories, true)).toBe(150_000);
  });
});
