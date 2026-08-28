import { describe, expect, it } from "vitest";
import { buildInstallmentPlan } from "./installments";
import { simulatePurchase, type SimulationFutureMonth, type SimulationInput } from "./simulate";

const FUTURE_MONTHS: SimulationFutureMonth[] = [
  { monthKey: "2026-09", expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
  { monthKey: "2026-10", expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
  { monthKey: "2026-11", expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
  { monthKey: "2026-12", expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
  { monthKey: "2027-01", expectedIncomeCents: 0, expectedAccountExpensesCents: 0, invoicesDueCents: 0, scheduledContributionsCents: 0 },
];

function baseInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    amountCents: 300_000,
    categoryId: "cat1",
    method: "CARD",
    installments: 10,
    purchaseDate: "2026-08-08",
    card: {
      closingDay: 12,
      dueDay: 20,
      limitCents: 1_000_000,
      unpaidInvoiceTotalBeforeCents: 0,
      utilizationTargetPercent: 70,
      currentInvoiceMonthKey: "2026-08",
      nextInvoiceMonthKey: "2026-09",
      currentInvoiceTotalBeforeCents: 0,
      nextInvoiceTotalBeforeCents: 0,
    },
    todayBalanceCents: 1_000_000,
    futureMonths: FUTURE_MONTHS,
    ...overrides,
  };
}

describe("R10 — R$3,000 in 10x on a card", () => {
  const result = simulatePurchase(baseInput());

  it("raises the current and next invoice by 300 each", () => {
    expect(result.invoiceImpact?.currentInvoiceAfterCents! - result.invoiceImpact?.currentInvoiceBeforeCents!).toBe(30_000);
    expect(result.invoiceImpact?.nextInvoiceAfterCents! - result.invoiceImpact?.nextInvoiceBeforeCents!).toBe(30_000);
  });

  it("drops available limit by exactly the purchase amount and recalculates utilization", () => {
    expect(result.limitImpact?.availableAfterCents! - result.limitImpact?.availableBeforeCents!).toBe(-300_000);
    expect(result.limitImpact?.utilizationBeforePercent).toBe(0);
    expect(result.limitImpact?.utilizationAfterPercent).toBeCloseTo(30, 5);
  });

it("declines by exactly 300 from one projected month to the next, since each month adds one more R$300 installment", () => {
    // before is flat (no baseline change), so the after-series' own month-over-month
    // drop is the purchase's per-month effect: series[0] is today, [1..5] are the
    // next five months, each one R$300 more committed than the last.
    for (let i = 0; i < 5; i++) {
      expect(result.projectedBalanceAfter[i] - result.projectedBalanceAfter[i + 1]).toBe(30_000);
    }
  });
});

describe("R10 — warnings", () => {
  it("crossing the utilization target returns a warning with the number and the target", () => {
    const result = simulatePurchase(baseInput({ card: { ...baseInput().card!, limitCents: 350_000, utilizationTargetPercent: 50 } }));
    const warning = result.warnings.find((w) => w.kind === "utilization");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain("50%");
  });

  it("busting a category limit returns a warning pointing to the installment's month", () => {
    const result = simulatePurchase(
      baseInput({
        installments: 1, // single installment, lands purely on the August (current) invoice
        categoryLimit: { amountCents: 20_000, spentBeforeByMonth: {} },
      })
    );
    const warning = result.warnings.find((w) => w.kind === "category_limit");
    expect(warning?.message).toContain("2026-08");
  });

  it("a harmless simulation returns an explicit positive confirmation", () => {
    const result = simulatePurchase(
      baseInput({
        amountCents: 1_000,
        installments: 1,
        card: { ...baseInput().card!, limitCents: 10_000_000, utilizationTargetPercent: 90 },
      })
    );
    expect(result.warnings).toEqual([{ kind: "ok", message: expect.any(String) }]);
  });
});

describe("R10 — purity and fidelity", () => {
  it("doesn't mutate its input", () => {
    const input = baseInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    simulatePurchase(input);
    expect(input).toEqual(snapshot);
  });

  it("recording the real purchase would use exactly the simulated installment plan", () => {
    const input = baseInput();
    const result = simulatePurchase(input);
    const directPlan = buildInstallmentPlan(
      input.amountCents,
      input.installments,
      input.purchaseDate,
      input.card!.closingDay,
      input.card!.dueDay
    );
    expect(result.installmentPlan).toEqual(directPlan);
  });
});
