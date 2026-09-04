import { describe, expect, it } from "vitest";
import { accountTransactionDirection, calculateAccountBalance, calculateAccountFlows } from "./accounts";
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

describe("R12 — per-transaction direction (ledger row coloring)", () => {
  it("INCOME into this account is \"in\"", () => {
    expect(accountTransactionDirection(ACC, tx({ kind: "INCOME", amountCents: 50_000 }))).toBe("in");
  });

  it("EXPENSE debited from this account (method=ACCOUNT) is \"out\"", () => {
    expect(accountTransactionDirection(ACC, tx({ kind: "EXPENSE", amountCents: 20_000, method: "ACCOUNT" }))).toBe(
      "out"
    );
  });

  it("a card EXPENSE (method=CARD) doesn't touch this account", () => {
    expect(accountTransactionDirection(ACC, tx({ kind: "EXPENSE", amountCents: 20_000, method: "CARD" }))).toBeNull();
  });

  it("TRANSFER is \"out\" for the source account and \"in\" for the destination", () => {
    const t = tx({ kind: "TRANSFER", amountCents: 200_000, accountId: ACC, toAccountId: OTHER });
    expect(accountTransactionDirection(ACC, t)).toBe("out");
    expect(accountTransactionDirection(OTHER, t)).toBe("in");
  });

  it("INVESTMENT_IN is \"out\", INVESTMENT_OUT is \"in\"", () => {
    expect(accountTransactionDirection(ACC, tx({ kind: "INVESTMENT_IN", amountCents: 30_000 }))).toBe("out");
    expect(accountTransactionDirection(ACC, tx({ kind: "INVESTMENT_OUT", amountCents: 10_000 }))).toBe("in");
  });

  it("CARD_PAYMENT is \"out\" for the paying account", () => {
    expect(accountTransactionDirection(ACC, tx({ kind: "CARD_PAYMENT", amountCents: 234_00 }))).toBe("out");
  });

  it("CARD_ADJUSTMENT and GOAL_IN/GOAL_OUT never touch the account", () => {
    expect(accountTransactionDirection(ACC, tx({ kind: "CARD_ADJUSTMENT", amountCents: 1_840 }))).toBeNull();
    expect(accountTransactionDirection(ACC, tx({ kind: "GOAL_IN", amountCents: 5_000 }))).toBeNull();
    expect(accountTransactionDirection(ACC, tx({ kind: "GOAL_OUT", amountCents: 2_000 }))).toBeNull();
  });
});

describe("R12 — account inflow/outflow totals include transfers", () => {
  it("a transfer out of the account counts as an outflow, not just a balance debit", () => {
    // Reproduces the reported bug: R$ 40 and R$ 240 transferred out of the
    // account never showed up in "Saídas" because isExpense() excludes
    // TRANSFER (R1) — right for the P&L, wrong for this account's own ledger.
    const { inflowsCents, outflowsCents } = calculateAccountFlows(
      ACC,
      [
        tx({ kind: "TRANSFER", amountCents: 40_00, toAccountId: OTHER }),
        tx({ kind: "TRANSFER", amountCents: 240_00, toAccountId: OTHER }),
        tx({ kind: "EXPENSE", amountCents: 900_00, method: "ACCOUNT" }),
        tx({ kind: "INCOME", amountCents: 14_000_00 }),
        tx({ kind: "EXPENSE", amountCents: 1_153_64, method: "ACCOUNT" }),
        tx({ kind: "EXPENSE", amountCents: 240_00, method: "ACCOUNT" }),
        tx({ kind: "EXPENSE", amountCents: 930_00, method: "ACCOUNT" }),
        tx({ kind: "EXPENSE", amountCents: 700_00, method: "ACCOUNT" }),
      ],
      TODAY
    );
    expect(inflowsCents).toBe(14_000_00);
    expect(outflowsCents).toBe(420_364); // R$ 4.203,64 = R$ 3.923,64 of expenses + R$ 280,00 transferred out
  });

  it("a transfer into the account counts as an inflow", () => {
    const { inflowsCents, outflowsCents } = calculateAccountFlows(
      ACC,
      [tx({ kind: "TRANSFER", amountCents: 500_00, accountId: OTHER, toAccountId: ACC })],
      TODAY
    );
    expect(inflowsCents).toBe(500_00);
    expect(outflowsCents).toBe(0);
  });

  it("a future-dated transaction isn't counted yet", () => {
    const { inflowsCents } = calculateAccountFlows(
      ACC,
      [tx({ kind: "INCOME", amountCents: 50_000, competenceDate: "2026-09-15" })],
      TODAY
    );
    expect(inflowsCents).toBe(0);
  });
});
