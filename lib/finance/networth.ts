// R11 — net worth.

export interface NetWorthInput {
  accountBalances: number[];
  investmentValues: number[];
  /** Sum of open invoice balances, only used when subtractOpenInvoices is true. */
  openInvoicesTotal?: number;
  /** Settings.netWorthSubtractsOpenInvoices — see docs/agents/07-open-decisions.md D1. */
  subtractOpenInvoices: boolean;
}

export function calculateNetWorth(input: NetWorthInput): number {
  const assets =
    input.accountBalances.reduce((sum, v) => sum + v, 0) +
    input.investmentValues.reduce((sum, v) => sum + v, 0);

  if (!input.subtractOpenInvoices) return assets;

  return assets - (input.openInvoicesTotal ?? 0);
}
