// R10 — purchase simulation. Pure: no database writes, no side effects.
import { buildInstallmentPlan, type InstallmentPlanItem } from "./installments";
import { calculateAvailableLimit } from "./invoice";
import { formatBRL } from "./money";
import { calculateProjectedBalanceSeries, type MonthlyProjectionInputs } from "./projection";
import type { PaymentMethod } from "./types";

export interface SimulationCardState {
  closingDay: number;
  dueDay: number;
  limitCents: number;
  /** Sum of amountCents already committed on unpaid invoices, before this purchase. */
  unpaidInvoiceTotalBeforeCents: number;
  utilizationTargetPercent: number;
  currentInvoiceMonthKey: string; // "YYYY-MM"
  nextInvoiceMonthKey: string; // "YYYY-MM"
  currentInvoiceTotalBeforeCents: number;
  nextInvoiceTotalBeforeCents: number;
}

export interface SimulationCategoryLimitState {
  amountCents: number;
  /** Already-spent cents keyed by "YYYY-MM" reference month. */
  spentBeforeByMonth: Record<string, number>;
}

export interface SimulationFutureMonth extends MonthlyProjectionInputs {
  monthKey: string; // "YYYY-MM"
}

export interface SimulationInput {
  amountCents: number;
  categoryId: string;
  method: PaymentMethod;
  installments: number;
  purchaseDate: string;
  card?: SimulationCardState;
  categoryLimit?: SimulationCategoryLimitState;
  todayBalanceCents: number;
  futureMonths: SimulationFutureMonth[];
  /** D2 floor for the projected balance; null/undefined = 0. */
  minCashCents?: number | null;
}

export interface SimulationWarning {
  kind: "utilization" | "category_limit" | "negative_balance" | "ok";
  message: string;
}

export interface SimulationResult {
  installmentPlan: InstallmentPlanItem[];
  invoiceImpact: {
    currentInvoiceBeforeCents: number;
    currentInvoiceAfterCents: number;
    nextInvoiceBeforeCents: number;
    nextInvoiceAfterCents: number;
  } | null;
  limitImpact: {
    availableBeforeCents: number;
    availableAfterCents: number;
    utilizationBeforePercent: number;
    utilizationAfterPercent: number;
  } | null;
  projectedBalanceBefore: number[];
  projectedBalanceAfter: number[];
  warnings: SimulationWarning[];
}

function purchaseMonthKey(purchaseDate: string): string {
  return purchaseDate.slice(0, 7);
}

export function simulatePurchase(input: SimulationInput): SimulationResult {
  const warnings: SimulationWarning[] = [];

  const installmentPlan =
    input.method === "CARD" && input.card
      ? buildInstallmentPlan(
          input.amountCents,
          input.installments,
          input.purchaseDate,
          input.card.closingDay,
          input.card.dueDay
        )
      : [];

  const planByMonthKey = new Map<string, number>();
  for (const item of installmentPlan) {
    const key = `${item.referenceMonth.year}-${String(item.referenceMonth.month).padStart(2, "0")}`;
    planByMonthKey.set(key, (planByMonthKey.get(key) ?? 0) + item.amountCents);
  }

  let invoiceImpact: SimulationResult["invoiceImpact"] = null;
  let limitImpact: SimulationResult["limitImpact"] = null;

  if (input.method === "CARD" && input.card) {
    const card = input.card;
    const currentAdd = planByMonthKey.get(card.currentInvoiceMonthKey) ?? 0;
    const nextAdd = planByMonthKey.get(card.nextInvoiceMonthKey) ?? 0;

    invoiceImpact = {
      currentInvoiceBeforeCents: card.currentInvoiceTotalBeforeCents,
      currentInvoiceAfterCents: card.currentInvoiceTotalBeforeCents + currentAdd,
      nextInvoiceBeforeCents: card.nextInvoiceTotalBeforeCents,
      nextInvoiceAfterCents: card.nextInvoiceTotalBeforeCents + nextAdd,
    };

    const before = calculateAvailableLimit({
      limitCents: card.limitCents,
      unpaidInvoiceTotalCents: card.unpaidInvoiceTotalBeforeCents,
    });
    const after = calculateAvailableLimit({
      limitCents: card.limitCents,
      unpaidInvoiceTotalCents: card.unpaidInvoiceTotalBeforeCents + input.amountCents,
    });

    limitImpact = {
      availableBeforeCents: before.availableCents,
      availableAfterCents: after.availableCents,
      utilizationBeforePercent: before.utilizationPercent,
      utilizationAfterPercent: after.utilizationPercent,
    };

    if (after.utilizationPercent > card.utilizationTargetPercent) {
      warnings.push({
        kind: "utilization",
        message: `Utilização do cartão vai a ${Math.round(after.utilizationPercent)}%, acima da meta de ${card.utilizationTargetPercent}%`,
      });
    }
  }

  if (input.categoryLimit) {
    for (const [monthKey, addCents] of planByMonthKey) {
      const spentBefore = input.categoryLimit.spentBeforeByMonth[monthKey] ?? 0;
      if (spentBefore + addCents > input.categoryLimit.amountCents) {
        warnings.push({
          kind: "category_limit",
          message: `A parcela de ${monthKey} estoura o limite da categoria (${formatBRL(spentBefore + addCents)} de ${formatBRL(input.categoryLimit.amountCents)})`,
        });
      }
    }
  }

  const projectedBalanceBefore = calculateProjectedBalanceSeries(input.todayBalanceCents, input.futureMonths);

  const futureMonthsAfter = input.futureMonths.map((month) => {
    if (input.method === "CARD") {
      const addCents = planByMonthKey.get(month.monthKey) ?? 0;
      return addCents ? { ...month, invoicesDueCents: month.invoicesDueCents + addCents } : month;
    }
    const addCents = month.monthKey === purchaseMonthKey(input.purchaseDate) ? input.amountCents : 0;
    return addCents
      ? { ...month, expectedAccountExpensesCents: month.expectedAccountExpensesCents + addCents }
      : month;
  });

  const projectedBalanceAfter = calculateProjectedBalanceSeries(input.todayBalanceCents, futureMonthsAfter);

  const floor = input.minCashCents ?? 0;
  projectedBalanceAfter.forEach((balance, index) => {
    if (index === 0) return; // series[0] is today's balance, not a projected future month
    if (balance < floor) {
      const monthKey = input.futureMonths[index - 1]?.monthKey ?? "?";
      warnings.push({
        kind: "negative_balance",
        message: `Saldo projetado abaixo de ${formatBRL(floor)} em ${monthKey}`,
      });
    }
  });

  if (warnings.length === 0) {
    warnings.push({ kind: "ok", message: "Nenhum problema identificado com esta compra." });
  }

  return { installmentPlan, invoiceImpact, limitImpact, projectedBalanceBefore, projectedBalanceAfter, warnings };
}
