// Plain types mirroring prisma/schema.prisma, kept independent of Prisma
// per CLAUDE.md — lib/finance/ must not import @prisma/client.

export type TxKind =
  | "EXPENSE"
  | "INCOME"
  | "TRANSFER"
  | "INVESTMENT_IN"
  | "INVESTMENT_OUT"
  | "GOAL_IN"
  | "GOAL_OUT"
  | "CARD_PAYMENT"
  | "CARD_ADJUSTMENT";

export type PaymentMethod = "ACCOUNT" | "CARD";

export type Confidence = "REALIZED" | "CONFIRMED" | "RECURRING" | "PROJECTED";

export type Frequency = "MONTHLY" | "WEEKLY" | "YEARLY";

export type RuleStatus = "ACTIVE" | "PAUSED" | "ENDED";

export type CategoryNature = "FIXED" | "VARIABLE" | "COMMITMENT" | "INCOME";

export type LimitScope = "TOTAL_MONTH" | "CATEGORY" | "CARD_UTILIZATION";

export interface FinanceTransaction {
  id: string;
  kind: TxKind;
  amountCents: number;
  competenceDate: string; // YYYY-MM-DD
  categoryId?: string | null;
  accountId?: string | null;
  toAccountId?: string | null;
  cardId?: string | null;
  invoiceId?: string | null;
  method?: PaymentMethod | null;
}

export interface FinanceCategory {
  id: string;
  nature: CategoryNature;
}
