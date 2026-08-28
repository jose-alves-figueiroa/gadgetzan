// R13 — alerts: the 10 triggers, ordered by severity, capped on the dashboard.
import { formatBRL } from "./money";

export type AlertSeverity = "critical" | "warning" | "info" | "positive";

export interface Alert {
  alertKey: string;
  severity: AlertSeverity;
  title: string;
  /** At least one action per alert (R13). */
  actions: string[];
}

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "warning", "info", "positive"];

export function sortBySeverity(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
}

/** The dashboard shows at most `max` "needs attention" alerts; positive ones aren't capped here. */
export function selectDashboardAlerts(alerts: Alert[], max = 3): Alert[] {
  return sortBySeverity(alerts.filter((a) => a.severity !== "positive")).slice(0, max);
}

export function filterDismissed(alerts: Alert[], dismissedKeys: Set<string>): Alert[] {
  return alerts.filter((a) => !dismissedKeys.has(a.alertKey));
}

// ---------- Triggers ----------

export function categoryLimitAlert(input: {
  categoryId: string;
  categoryName: string;
  spentCents: number;
  amountCents: number;
  warnAtPercent: number;
  daysRemaining: number;
  consecutiveMonthsExceeded: number;
}): Alert | null {
  if (input.amountCents === 0) return null;
  const percent = (input.spentCents / input.amountCents) * 100;

  if (percent >= 100) {
    return {
      alertKey: `limit-exceeded:${input.categoryId}`,
      severity: "critical",
      title: `${formatBRL(input.spentCents - input.amountCents)} acima do limite de ${input.categoryName}, ${input.consecutiveMonthsExceeded}º mês seguido`,
      actions: ["Ver categoria"],
    };
  }

  if (percent >= input.warnAtPercent) {
    return {
      alertKey: `limit-warning:${input.categoryId}`,
      severity: "warning",
      title: `${Math.round(percent)}% do limite de ${input.categoryName} usado (${formatBRL(input.spentCents)} de ${formatBRL(input.amountCents)}, ${input.daysRemaining} dias restantes)`,
      actions: ["Ver categoria"],
    };
  }

  return null;
}

export function cardUtilizationAlert(input: {
  cardId: string;
  cardName: string;
  utilizationPercent: number;
  targetPercent: number;
}): Alert | null {
  if (input.utilizationPercent <= input.targetPercent) return null;
  return {
    alertKey: `card-utilization:${input.cardId}`,
    severity: "warning",
    title: `Utilização do cartão ${input.cardName} em ${Math.round(input.utilizationPercent)}%`,
    actions: ["Ver fatura"],
  };
}

export function invoiceSpikeAlert(input: {
  cardId: string;
  month: string;
  previousCents: number;
  currentCents: number;
  causeDescriptions: string[];
}): Alert | null {
  if (input.previousCents === 0) return null;
  const increasePercent = ((input.currentCents - input.previousCents) / input.previousCents) * 100;
  if (increasePercent <= 25) return null;

  return {
    alertKey: `invoice-spike:${input.cardId}:${input.month}`,
    severity: "warning",
    title: `Fatura de ${input.month} ${Math.round(increasePercent)}% maior — ${input.causeDescriptions.join(", ")}`,
    actions: ["Ver fatura"],
  };
}

export function negativeProjectedBalanceAlert(input: { month: string; projectedBalanceCents: number }): Alert | null {
  if (input.projectedBalanceCents >= 0) return null;
  return {
    alertKey: `negative-balance:${input.month}`,
    severity: "critical",
    title: `Saldo projetado negativo em ${input.month}`,
    actions: ["Ver mês"],
  };
}

export function goalBehindPaceAlert(input: { goalId: string; goalName: string; behindByCents: number }): Alert | null {
  if (input.behindByCents <= 0) return null;
  return {
    alertKey: `goal-behind-pace:${input.goalId}`,
    severity: "warning",
    title: `${formatBRL(input.behindByCents)} abaixo do ritmo em ${input.goalName}`,
    actions: ["Ver porquinho"],
  };
}

export function variableCategoryAboveAverageAlert(input: {
  categoryId: string;
  categoryName: string;
  currentCents: number;
  averageCents: number;
}): Alert | null {
  if (input.averageCents === 0) return null;
  const changePercent = ((input.currentCents - input.averageCents) / input.averageCents) * 100;
  if (changePercent <= 20) return null;
  return {
    alertKey: `variable-above:${input.categoryId}`,
    severity: "warning",
    title: `${input.categoryName} ${Math.round(changePercent)}% acima da sua média`,
    actions: ["Ver análise"],
  };
}

export function variableCategoryBelowAverageAlert(input: {
  categoryId: string;
  categoryName: string;
  currentCents: number;
  averageCents: number;
}): Alert | null {
  if (input.averageCents === 0) return null;
  const changePercent = ((input.averageCents - input.currentCents) / input.averageCents) * 100;
  if (changePercent <= 0) return null;
  return {
    alertKey: `variable-below:${input.categoryId}`,
    severity: "positive",
    title: `${input.categoryName} ${Math.round(changePercent)}% abaixo da sua média`,
    actions: ["Ver análise"],
  };
}

export function largeInstallmentAlert(input: {
  purchaseId: string;
  amountCents: number;
  month: string;
  avgIncomeCents: number;
}): Alert | null {
  if (input.avgIncomeCents === 0) return null;
  const percentOfIncome = (input.amountCents / input.avgIncomeCents) * 100;
  if (percentOfIncome <= 10) return null;
  return {
    alertKey: `large-installment:${input.purchaseId}`,
    severity: "info",
    title: `Nova parcela de ${formatBRL(input.amountCents)} começa em ${input.month}`,
    actions: ["Ver compra"],
  };
}

export function netWorthGrowthAlert(input: { monthlyGrowthCents: number; targetCents: number }): Alert | null {
  if (input.monthlyGrowthCents <= input.targetCents) return null;
  return {
    alertKey: "networth-growth",
    severity: "positive",
    title: `Patrimônio líquido crescendo ${formatBRL(input.monthlyGrowthCents)}/mês`,
    actions: ["Ver patrimônio"],
  };
}
