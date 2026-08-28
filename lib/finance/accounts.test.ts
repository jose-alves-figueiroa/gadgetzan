import { describe, expect, it } from "vitest";
import { calculateAccountBalance } from "./accounts";
import type { FinanceTransaction } from "./types";

const ACC = "acc1";
const OTHER = "acc2";
const TODAY = "2026-08-28";

function tx(overrides: Partial<FinanceTransaction> & Pick<FinanceTransaction, "kind" | "amountCents">): FinanceTransaction {
  return {
    id: Math.random().toString(),
    competenceDate: TODAY,
    accountId: ACC,
    ...overrides,
  };
}

describe("R12 — account balance", () => {
  it("adds INCOME and subtracts EXPENSE(method=ACCOUNT)", () => {
    const balance = calculateAccountBalance(ACC, 100_000, [
      tx({ kind: "INCOME", amountCents: 50_000 }),
      tx({ kind: "EXPENSE", amountCents: 20_000, method: "ACCOUNT" }),
    ], TODAY);
    expect(balance).toBe(130_000);
  });

  it("a card EXPENSE (method=CARD) doesn't touch the account", () => {
    const balance = calculateAccountBalance(ACC, 100_000, [
      tx({ kind: "EXPENSE", amountCents: 20_000, method: "CARD" }),
    ], TODAY);
    expect(balance).toBe(100_000);
  });

  it("TRANSFER debits the source and credits the destination", () => {
    const t = tx({ kind: "TRANSFER", amountCents: 200_000, accountId: ACC, toAccountId: OTHER });
    expect(calculateAccountBalance(ACC, 100_000, [t], TODAY)).toBe(-100_000);
    expect(calculateAccountBalance(OTHER, 0, [t], TODAY)).toBe(200_000);
  });

  it("INVESTMENT_IN debits, INVESTMENT_OUT credits", () => {
    const balance = calculateAccountBalance(ACC, 100_000, [
      tx({ kind: "INVESTMENT_IN", amountCents: 30_000 }),
      tx({ kind: "INVESTMENT_OUT", amountCents: 10_000 }),
    ], TODAY);
    expect(balance).toBe(80_000);
  });

  it("CARD_PAYMENT debits the paying account", () => {
    const balance = calculateAccountBalance(ACC, 100_000, [
      tx({ kind: "CARD_PAYMENT", amountCents: 234_00 }),
    ], TODAY);
    expect(balance).toBe(100_000 - 23_400);
  });

  it("CARD_ADJUSTMENT never touches the account — it stays on the invoice", () => {
    const balance = calculateAccountBalance(ACC, 100_000, [
      tx({ kind: "CARD_ADJUSTMENT", amountCents: 1_840 }),
    ], TODAY);
    expect(balance).toBe(100_000);
  });

  it("GOAL_IN/GOAL_OUT never touch the account — they're a logical reserve", () => {
    const balance = calculateAccountBalance(ACC, 100_000, [
      tx({ kind: "GOAL_IN", amountCents: 5_000 }),
      tx({ kind: "GOAL_OUT", amountCents: 2_000 }),
    ], TODAY);
    expect(balance).toBe(100_000);
  });

  it("a future-dated transaction doesn't change the current balance", () => {
    const balance = calculateAccountBalance(ACC, 100_000, [
      tx({ kind: "INCOME", amountCents: 50_000, competenceDate: "2026-09-15" }),
    ], TODAY);
    expect(balance).toBe(100_000);
  });
});
