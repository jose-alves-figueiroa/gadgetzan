import { describe, expect, it } from "vitest";
import {
  buildInstallmentPlan,
  buildRemainingInstallmentPlan,
  installmentsToDelete,
  recalculateInstallments,
  splitInstallments,
} from "./installments";

describe("R4 — splitting installments", () => {
  it("R$100.00 in 3x → 33.33 / 33.33 / 33.34, remainder on the last one", () => {
    expect(splitInstallments(10_000, 3)).toEqual([3333, 3333, 3334]);
  });

  it("splits evenly when it divides cleanly", () => {
    expect(splitInstallments(600_000, 10)).toEqual(new Array(10).fill(60_000));
  });
});

describe("R4 — installment plan", () => {
  it("R$6,000 in 10x on 08/08 (closingDay=12, dueDay=20): installment 1 on August, installment 10 on May/2027, +600 in September", () => {
    const plan = buildInstallmentPlan(600_000, 10, "2026-08-08", 12, 20);

    expect(plan[0].installmentNo).toBe(1);
    expect(plan[0].referenceMonth).toEqual({ year: 2026, month: 8 });
    expect(plan[9].installmentNo).toBe(10);
    expect(plan[9].referenceMonth).toEqual({ year: 2027, month: 5 });

    const september = plan.find((p) => p.referenceMonth.year === 2026 && p.referenceMonth.month === 9);
    expect(september?.amountCents).toBe(60_000);
  });

  it("each installment carries a consecutive installmentNo 1..n", () => {
    const plan = buildInstallmentPlan(300_000, 3, "2026-08-08", 12, 20);
    expect(plan.map((p) => p.installmentNo)).toEqual([1, 2, 3]);
  });
});

describe("R4 — each installment burdens its own competence month", () => {
  it("installment 1 keeps the real purchase date; installment N>1 lands on its own invoice due date", () => {
    const plan = buildInstallmentPlan(300_000, 3, "2026-08-08", 12, 20);
    expect(plan.map((p) => p.competenceDate)).toEqual(["2026-08-08", "2026-09-20", "2026-10-20"]);
  });
});

describe("R4 — editing recalculates only unpaid installments", () => {
  it("editing a 10x R$6,000 purchase to 6x keeps the 2 paid installments untouched", () => {
    const original = buildInstallmentPlan(600_000, 10, "2026-08-08", 12, 20);
    const paid = original.slice(0, 2); // installments 1 and 2 already paid

    const recalculated = recalculateInstallments(paid, 600_000, 6, "2026-08-08", 12, 20);

    // paid installments are frozen exactly as they were
    expect(recalculated[0]).toEqual(original[0]);
    expect(recalculated[1]).toEqual(original[1]);

    // remaining total (600,000 − 120,000 paid) split across the remaining 4 slots
    expect(recalculated).toHaveLength(6);
    expect(recalculated.slice(2).map((p) => p.amountCents)).toEqual([120_000, 120_000, 120_000, 120_000]);
    expect(recalculated[5].installmentNo).toBe(6);
  });

  it("every recalculated (unpaid) installment accrues on its own invoice due date, including the first unpaid one", () => {
    const original = buildInstallmentPlan(600_000, 10, "2026-08-08", 12, 20);
    const paid = original.slice(0, 2);

    const recalculated = recalculateInstallments(paid, 600_000, 6, "2026-08-08", 12, 20);

    expect(recalculated.slice(2).map((p) => p.competenceDate)).toEqual(recalculated.slice(2).map((p) => p.dueDate));
  });
});

describe("R15 — importing the remaining installments of an in-progress purchase", () => {
  it("2 of 4 → seeds only installments 2, 3, 4, one month apart, same amount repeated", () => {
    const plan = buildRemainingInstallmentPlan(36_808, 2, 4, "2026-08-08", 12, 20);

    expect(plan.map((p) => p.installmentNo)).toEqual([2, 3, 4]);
    expect(plan.map((p) => p.amountCents)).toEqual([36_808, 36_808, 36_808]);
    expect(plan.map((p) => p.referenceMonth)).toEqual([
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
    ]);
  });

  it("the last installment (N of N) seeds exactly one row", () => {
    const plan = buildRemainingInstallmentPlan(36_808, 4, 4, "2026-10-08", 12, 20);
    expect(plan).toHaveLength(1);
    expect(plan[0].installmentNo).toBe(4);
  });

  it("the current installment keeps its real (imported) date; the rest accrue on their own invoice due date", () => {
    const plan = buildRemainingInstallmentPlan(36_808, 2, 4, "2026-08-08", 12, 20);
    expect(plan.map((p) => p.competenceDate)).toEqual(["2026-08-08", "2026-09-20", "2026-10-20"]);
  });
});

describe("R4 — deleting a purchase removes future installments, keeps paid ones", () => {
  it("returns only the unpaid (future) installments — the paid ones are kept", () => {
    const plan = buildInstallmentPlan(300_000, 3, "2026-08-08", 12, 20);
    const toDelete = installmentsToDelete(plan, new Set([1, 2]));
    expect(toDelete.map((i) => i.installmentNo)).toEqual([3]);
  });
});
