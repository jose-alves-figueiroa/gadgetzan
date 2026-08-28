import { describe, expect, it } from "vitest";
import {
  categoryLimitAlert,
  filterDismissed,
  invoiceSpikeAlert,
  selectDashboardAlerts,
  type Alert,
} from "./alerts";
import { formatBRL } from "./money";

describe("R13 — category limit alerts", () => {
  it("85% used with warnAtPercent=80 is a warning naming amount used, total, and days remaining", () => {
    const alert = categoryLimitAlert({
      categoryId: "c1",
      categoryName: "Alimentação",
      spentCents: 850_00,
      amountCents: 1_000_00,
      warnAtPercent: 80,
      daysRemaining: 6,
      consecutiveMonthsExceeded: 0,
    });
    expect(alert?.severity).toBe("warning");
    expect(alert?.title).toContain("85%");
    expect(alert?.title).toContain(formatBRL(850_00));
    expect(alert?.title).toContain(formatBRL(1_000_00));
    expect(alert?.title).toContain("6 dias");
  });

  it("an exceeded limit is critical and states consecutive months", () => {
    const alert = categoryLimitAlert({
      categoryId: "c1",
      categoryName: "Alimentação",
      spentCents: 1_400_00,
      amountCents: 1_000_00,
      warnAtPercent: 80,
      daysRemaining: 2,
      consecutiveMonthsExceeded: 3,
    });
    expect(alert?.severity).toBe("critical");
    expect(alert?.title).toContain("3º mês seguido");
  });

  it("below the warn threshold generates no alert", () => {
    const alert = categoryLimitAlert({
      categoryId: "c1",
      categoryName: "Alimentação",
      spentCents: 500_00,
      amountCents: 1_000_00,
      warnAtPercent: 80,
      daysRemaining: 10,
      consecutiveMonthsExceeded: 0,
    });
    expect(alert).toBeNull();
  });

  it("every generated alert has at least one action", () => {
    const alert = categoryLimitAlert({
      categoryId: "c1",
      categoryName: "Alimentação",
      spentCents: 850_00,
      amountCents: 1_000_00,
      warnAtPercent: 80,
      daysRemaining: 6,
      consecutiveMonthsExceeded: 0,
    });
    expect(alert?.actions.length).toBeGreaterThan(0);
  });
});

describe("R13 — invoice spike names the installments responsible", () => {
  it("a 32% higher invoice generates a warning naming the cause", () => {
    const alert = invoiceSpikeAlert({
      cardId: "card1",
      month: "Setembro",
      previousCents: 1_000_00,
      currentCents: 1_320_00,
      causeDescriptions: ["parcela 3/10 de Notebook"],
    });
    expect(alert?.severity).toBe("warning");
    expect(alert?.title).toContain("32%");
    expect(alert?.title).toContain("parcela 3/10 de Notebook");
  });

  it("a rise under 25% generates no alert", () => {
    const alert = invoiceSpikeAlert({
      cardId: "card1",
      month: "Setembro",
      previousCents: 1_000_00,
      currentCents: 1_100_00,
      causeDescriptions: [],
    });
    expect(alert).toBeNull();
  });
});

describe("R13 — dashboard cap and dismissal", () => {
  function warning(key: string): Alert {
    return { alertKey: key, severity: "warning", title: key, actions: ["Ver"] };
  }

  it("never shows more than 3 needs-attention alerts on the dashboard", () => {
    const alerts = [warning("a"), warning("b"), warning("c"), warning("d"), warning("e")];
    expect(selectDashboardAlerts(alerts)).toHaveLength(3);
  });

  it("critical alerts rank ahead of warnings within the cap", () => {
    const alerts: Alert[] = [
      warning("w1"),
      { alertKey: "crit", severity: "critical", title: "crit", actions: ["Ver"] },
    ];
    const [first] = selectDashboardAlerts(alerts);
    expect(first.severity).toBe("critical");
  });

  it("a dismissed alert doesn't reappear", () => {
    const alerts = [warning("a"), warning("b")];
    const dismissed = new Set(["a"]);
    expect(filterDismissed(alerts, dismissed).map((a) => a.alertKey)).toEqual(["b"]);
  });
});
