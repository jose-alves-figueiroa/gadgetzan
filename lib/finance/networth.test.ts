import { describe, expect, it } from "vitest";
import { calculateNetWorth } from "./networth";

describe("R11 — net worth", () => {
  it("sums accounts + investments", () => {
    const netWorth = calculateNetWorth({
      accountBalances: [100_000, 50_000],
      investmentValues: [200_000],
      subtractOpenInvoices: false,
    });
    expect(netWorth).toBe(350_000);
  });

  it("subtracts open invoices only when the setting is enabled (D1)", () => {
    const input = { accountBalances: [100_000], investmentValues: [0], openInvoicesTotal: 23_400 };
    expect(calculateNetWorth({ ...input, subtractOpenInvoices: false })).toBe(100_000);
    expect(calculateNetWorth({ ...input, subtractOpenInvoices: true })).toBe(76_600);
  });

  it("updating an investment's currentCents is immediately reflected — no income involved", () => {
    const before = calculateNetWorth({ accountBalances: [0], investmentValues: [100_000], subtractOpenInvoices: false });
    const after = calculateNetWorth({ accountBalances: [0], investmentValues: [150_000], subtractOpenInvoices: false });
    expect(after - before).toBe(50_000);
  });
});
