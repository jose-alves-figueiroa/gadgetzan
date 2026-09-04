import { prisma } from "@/lib/db";
import type { Card } from "@prisma/client";
import { assignInvoice, calculateOutstandingBalance, reverseInvoicePayment } from "@/lib/finance/invoice";
import { buildInstallmentPlan, buildRemainingInstallmentPlan } from "@/lib/finance/installments";
import { findOrCreateInvoice } from "./invoices";
import { toPrismaDate } from "./clock";

/**
 * Prisma-touching core of every financial write, shared by the manually-entered
 * Server Actions (transactions.ts, invoice-operations.ts, goals.ts) and the CSV
 * importer (lib/server/imports/). No auth, no revalidation, no pt-BR string
 * parsing — callers resolve `userId` and pass integer `amountCents`. Every
 * create optionally threads `externalId`/`importBatchId` for the importer's
 * dedup/undo (docs/agents/02-business-rules.md R15).
 */

export interface BatchTag {
  externalId?: string | null;
  importBatchId?: string | null;
}

/** A transaction can't predate the account's own opening balance (05 § Form validations). */
export async function assertDateNotBeforeOpening(userId: string, accountId: string, competenceDate: string) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new Error("Conta não encontrada.");
  if (competenceDate < account.openingDate.toISOString().slice(0, 10)) {
    throw new Error("A data não pode ser anterior ao saldo inicial da conta.");
  }
}

export interface ExpenseOrIncomeCoreInput extends BatchTag {
  kind: "EXPENSE" | "INCOME";
  description: string;
  amountCents: number;
  competenceDate: string;
  categoryId: string;
  method: "ACCOUNT" | "CARD";
  accountId?: string | null;
  cardId?: string | null;
  /** >1 replicates the full R4 installment plan (Purchase + N Transactions) from this purchase date. */
  installments?: number;
  isFixed?: boolean;
  note?: string | null;
  /** Links this transaction back to the RecurrenceRule occurrence it fulfills (R6). */
  recurrenceId?: string | null;
}

/** Mirrors createTransaction's (transactions.ts) ACCOUNT/CARD/installment branching exactly. */
export async function createExpenseOrIncomeCore(userId: string, input: ExpenseOrIncomeCoreInput) {
  const installments = input.installments ?? 1;

  if (input.method === "CARD") {
    const card = await prisma.card.findFirst({ where: { id: input.cardId!, userId } });
    if (!card) throw new Error("Cartão não encontrado.");

    if (installments > 1) {
      return createInstallmentPurchaseCore(userId, card, input, installments);
    }

    const assignment = assignInvoice(input.competenceDate, card.closingDay, card.dueDay);
    const invoice = await findOrCreateInvoice(userId, card, assignment.referenceMonth, assignment.dueDate);
    return prisma.transaction.create({
      data: {
        userId,
        kind: input.kind,
        description: input.description,
        amountCents: input.amountCents,
        competenceDate: toPrismaDate(input.competenceDate),
        categoryId: input.categoryId,
        method: "CARD",
        cardId: card.id,
        invoiceId: invoice.id,
        isFixed: input.isFixed ?? false,
        note: input.note ?? null,
        externalId: input.externalId ?? null,
        importBatchId: input.importBatchId ?? null,
        recurrenceId: input.recurrenceId ?? null,
      },
    });
  }

  return prisma.transaction.create({
    data: {
      userId,
      kind: input.kind,
      description: input.description,
      amountCents: input.amountCents,
      competenceDate: toPrismaDate(input.competenceDate),
      categoryId: input.categoryId,
      method: "ACCOUNT",
      accountId: input.accountId!,
      isFixed: input.isFixed ?? false,
      note: input.note ?? null,
      externalId: input.externalId ?? null,
      importBatchId: input.importBatchId ?? null,
      recurrenceId: input.recurrenceId ?? null,
    },
  });
}

async function createInstallmentPurchaseCore(
  userId: string,
  card: Card,
  input: ExpenseOrIncomeCoreInput,
  installments: number
) {
  const plan = buildInstallmentPlan(input.amountCents, installments, input.competenceDate, card.closingDay, card.dueDay);

  const purchase = await prisma.purchase.create({
    data: {
      userId,
      description: input.description,
      totalCents: input.amountCents,
      installments,
      cardId: card.id,
      categoryId: input.categoryId,
      purchaseDate: toPrismaDate(input.competenceDate),
    },
  });

  let first;
  for (const item of plan) {
    const invoice = await findOrCreateInvoice(userId, card, item.referenceMonth, item.dueDate);
    const tx = await prisma.transaction.create({
      data: {
        userId,
        kind: "EXPENSE",
        description: `${input.description} (${item.installmentNo}/${installments})`,
        amountCents: item.amountCents,
        competenceDate: toPrismaDate(input.competenceDate),
        categoryId: input.categoryId,
        method: "CARD",
        cardId: card.id,
        invoiceId: invoice.id,
        purchaseId: purchase.id,
        installmentNo: item.installmentNo,
        isFixed: input.isFixed ?? false,
        note: input.note ?? null,
        externalId: input.externalId ? `${input.externalId}#${item.installmentNo}` : null,
        importBatchId: input.importBatchId ?? null,
      },
    });
    if (item.installmentNo === 1) first = tx;
  }
  return first!;
}

export interface RemainingInstallmentsCoreInput extends BatchTag {
  description: string;
  /** This installment's value — repeated for every remaining one (we don't know if earlier ones differed). */
  amountCents: number;
  /** Date of the CURRENT installment (currentInstallmentNo), not the original purchase date. */
  competenceDate: string;
  categoryId: string;
  cardId: string;
  currentInstallmentNo: number;
  totalInstallments: number;
  isFixed?: boolean;
  note?: string | null;
}

/**
 * Import-only (R15): seeds the not-yet-elapsed installments (current + future)
 * of an already-in-progress card purchase, without a Purchase row — we don't
 * have the earlier installments' real amounts or the original purchase date,
 * and they don't affect any future projection or limit math once they've
 * already happened. No `/purchases/[id]` grouping for these by design.
 */
export async function createRemainingInstallmentsCore(userId: string, input: RemainingInstallmentsCoreInput) {
  const card = await prisma.card.findFirst({ where: { id: input.cardId, userId } });
  if (!card) throw new Error("Cartão não encontrado.");

  const plan = buildRemainingInstallmentPlan(
    input.amountCents,
    input.currentInstallmentNo,
    input.totalInstallments,
    input.competenceDate,
    card.closingDay,
    card.dueDay
  );

  let first;
  for (const item of plan) {
    const invoice = await findOrCreateInvoice(userId, card, item.referenceMonth, item.dueDate);
    const tx = await prisma.transaction.create({
      data: {
        userId,
        kind: "EXPENSE",
        description: `${input.description} (${item.installmentNo}/${input.totalInstallments})`,
        amountCents: item.amountCents,
        competenceDate: item.installmentNo === input.currentInstallmentNo
          ? toPrismaDate(input.competenceDate)
          : toPrismaDate(item.dueDate),
        categoryId: input.categoryId,
        method: "CARD",
        cardId: card.id,
        invoiceId: invoice.id,
        installmentNo: item.installmentNo,
        isFixed: input.isFixed ?? false,
        note: input.note ?? null,
        externalId: input.externalId ? `${input.externalId}#${item.installmentNo}` : null,
        importBatchId: input.importBatchId ?? null,
      },
    });
    if (item.installmentNo === input.currentInstallmentNo) first = tx;
  }
  return first!;
}

export interface TransferCoreInput extends BatchTag {
  accountId: string;
  toAccountId: string;
  amountCents: number;
  competenceDate: string;
  note?: string | null;
}

export async function createTransferCore(userId: string, input: TransferCoreInput) {
  return prisma.transaction.create({
    data: {
      userId,
      kind: "TRANSFER",
      description: "Transferência entre contas",
      amountCents: input.amountCents,
      competenceDate: toPrismaDate(input.competenceDate),
      accountId: input.accountId,
      toAccountId: input.toAccountId,
      method: "ACCOUNT",
      note: input.note ?? null,
      externalId: input.externalId ?? null,
      importBatchId: input.importBatchId ?? null,
    },
  });
}

export interface InvestmentMoveCoreInput extends BatchTag {
  kind: "INVESTMENT_IN" | "INVESTMENT_OUT";
  investmentId: string;
  accountId: string;
  amountCents: number;
  competenceDate: string;
  /** Links this transaction back to the RecurrenceRule occurrence it fulfills (R6). */
  recurrenceId?: string | null;
}

/**
 * A contribution/withdrawal is principal moving, not a return — it must
 * move Investment.appliedCents/currentCents by the same amount right away,
 * or net worth (accounts + Σ currentCents, R12) visibly drops by the
 * contributed amount until someone manually revalues the investment later.
 * Manual revaluation (updating currentCents alone, to reflect an actual
 * market return) is a separate, not-yet-built action — see 02-business-rules
 * §"Investment returns are not income."
 */
export async function createInvestmentMoveCore(userId: string, input: InvestmentMoveCoreInput) {
  const investment = await prisma.investment.findFirst({ where: { id: input.investmentId, userId } });
  if (!investment) throw new Error("Investimento não encontrado.");

  const signedCents = input.kind === "INVESTMENT_IN" ? input.amountCents : -input.amountCents;

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        kind: input.kind,
        description: input.kind === "INVESTMENT_IN" ? `Aporte em ${investment.name}` : `Resgate de ${investment.name}`,
        amountCents: input.amountCents,
        competenceDate: toPrismaDate(input.competenceDate),
        accountId: input.accountId,
        investmentId: input.investmentId,
        method: "ACCOUNT",
        externalId: input.externalId ?? null,
        importBatchId: input.importBatchId ?? null,
        recurrenceId: input.recurrenceId ?? null,
      },
    }),
    prisma.investment.update({
      where: { id: investment.id },
      data: {
        appliedCents: investment.appliedCents + signedCents,
        currentCents: investment.currentCents + signedCents,
      },
    }),
  ]);

  return transaction;
}

export interface GoalMoveCoreInput extends BatchTag {
  kind: "GOAL_IN" | "GOAL_OUT";
  goalId: string;
  amountCents: number;
  competenceDate: string;
}

export async function createGoalMoveCore(userId: string, input: GoalMoveCoreInput) {
  const goal = await prisma.goal.findFirst({ where: { id: input.goalId, userId } });
  if (!goal) throw new Error("Porquinho não encontrado.");

  return prisma.transaction.create({
    data: {
      userId,
      kind: input.kind,
      description: input.kind === "GOAL_IN" ? `Guardado em ${goal.name}` : `Resgatado de ${goal.name}`,
      amountCents: input.amountCents,
      competenceDate: toPrismaDate(input.competenceDate),
      goalId: goal.id,
      accountId: goal.accountId,
      method: goal.accountId ? "ACCOUNT" : undefined,
      externalId: input.externalId ?? null,
      importBatchId: input.importBatchId ?? null,
    },
  });
}

/**
 * Sum of real charges (EXPENSE + CARD_ADJUSTMENT) tied to an invoice —
 * deliberately excludes CARD_PAYMENT itself. Summing every transaction
 * unfiltered (the pre-fix behavior) double-counts a prior partial payment
 * into the invoice's own "total", so a second payment never correctly
 * settles it.
 */
export async function sumInvoiceChargeCents(invoiceId: string): Promise<number> {
  const agg = await prisma.transaction.aggregate({
    where: { invoiceId, kind: { in: ["EXPENSE", "CARD_ADJUSTMENT"] } },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

export interface InvoicePaymentCoreInput extends BatchTag {
  invoiceId: string;
  accountId: string;
  paidCents: number;
  paidDate: string;
}

/** Pay (full or partial) — debits the account via a CARD_PAYMENT (R1: never an expense). */
export async function applyInvoicePaymentCore(userId: string, input: InvoicePaymentCoreInput) {
  const invoice = await prisma.invoice.findFirst({ where: { id: input.invoiceId, userId } });
  if (!invoice) throw new Error("Fatura não encontrada.");

  const invoiceTotalCents = invoice.manualTotalCents ?? (await sumInvoiceChargeCents(invoice.id));
  const paidSoFarCents = (invoice.paidCents ?? 0) + input.paidCents;
  const settled = calculateOutstandingBalance(invoiceTotalCents, paidSoFarCents) === 0;

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        kind: "CARD_PAYMENT",
        description: "Pagamento de fatura",
        amountCents: input.paidCents,
        competenceDate: toPrismaDate(input.paidDate),
        accountId: input.accountId,
        invoiceId: invoice.id,
        method: "ACCOUNT",
        externalId: input.externalId ?? null,
        importBatchId: input.importBatchId ?? null,
      },
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidCents: paidSoFarCents,
        paidAt: settled ? toPrismaDate(input.paidDate) : null,
      },
    }),
  ]);

  return transaction;
}

const TRANSFER_FOR_INVOICE_PAYMENT_NOTE = "Transferência para pagamento de fatura";

/**
 * "Pagar via transferência" (payInvoice with sourceAccountId) creates the
 * Transfer and the CARD_PAYMENT back to back with no field linking them —
 * so undoing the payment has to find its companion the same way a human
 * would: same destination account, amount, date and note. Only acts when
 * that match is unambiguous (exactly one candidate); with more than one, or
 * none, the transfer is left alone rather than guessing which one to delete.
 */
async function findCompanionTransferIds(
  userId: string,
  payments: Array<{ accountId: string | null; amountCents: number; competenceDate: Date }>
): Promise<string[]> {
  const ids: string[] = [];
  for (const payment of payments) {
    if (!payment.accountId) continue;
    const matches = await prisma.transaction.findMany({
      where: {
        userId,
        kind: "TRANSFER",
        toAccountId: payment.accountId,
        amountCents: payment.amountCents,
        competenceDate: payment.competenceDate,
        note: TRANSFER_FOR_INVOICE_PAYMENT_NOTE,
      },
      select: { id: true },
    });
    if (matches.length === 1) ids.push(matches[0].id);
  }
  return ids;
}

/**
 * Deletes a transaction, reversing any side effect it created. A CARD_PAYMENT
 * debited an account and advanced Invoice.paidCents/paidAt
 * (applyInvoicePaymentCore) — deleting it through the generic transaction
 * delete must undo exactly that, or the invoice keeps counting money that was
 * never actually paid. If it was paid via a transfer between accounts, that
 * unambiguous companion Transfer is reversed too, or the source account would
 * stay permanently short the transferred amount.
 */
export async function deleteTransactionCore(userId: string, id: string) {
  const transaction = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!transaction) return;

  if (transaction.kind === "CARD_PAYMENT" && transaction.invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: transaction.invoiceId, userId } });
    if (invoice) {
      const invoiceTotalCents = invoice.manualTotalCents ?? (await sumInvoiceChargeCents(invoice.id));
      const { paidCents, stillSettled } = reverseInvoicePayment(invoiceTotalCents, invoice.paidCents, transaction.amountCents);
      const companionTransferIds = await findCompanionTransferIds(userId, [transaction]);

      await prisma.$transaction([
        prisma.transaction.delete({ where: { id: transaction.id } }),
        ...(companionTransferIds.length
          ? [prisma.transaction.deleteMany({ where: { id: { in: companionTransferIds }, userId } })]
          : []),
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { paidCents, paidAt: stillSettled ? invoice.paidAt : null },
        }),
      ]);
      return;
    }
  }

  await prisma.transaction.deleteMany({ where: { id, userId } });
}

/** "Desfazer pagamento" — reverses every CARD_PAYMENT tied to the invoice back
 * to unpaid, including any unambiguous companion Transfer from "pagar via
 * transferência" (see findCompanionTransferIds). */
export async function unpayInvoiceCore(userId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId } });
  if (!invoice) throw new Error("Fatura não encontrada.");

  const payments = await prisma.transaction.findMany({ where: { userId, invoiceId, kind: "CARD_PAYMENT" } });
  const companionTransferIds = await findCompanionTransferIds(userId, payments);

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId, invoiceId, kind: "CARD_PAYMENT" } }),
    ...(companionTransferIds.length
      ? [prisma.transaction.deleteMany({ where: { id: { in: companionTransferIds }, userId } })]
      : []),
    prisma.invoice.update({ where: { id: invoice.id }, data: { paidCents: 0, paidAt: null } }),
  ]);
}

export interface AdjustInvoiceCoreInput extends BatchTag {
  invoiceId: string;
  amountCents: number;
  reason: string;
  competenceDate: string;
}

/** Interest, fees, chargeback — goes straight to the invoice as CARD_ADJUSTMENT (counts as an expense — R1/R3). */
export async function adjustInvoiceCore(userId: string, input: AdjustInvoiceCoreInput) {
  const invoice = await prisma.invoice.findFirst({ where: { id: input.invoiceId, userId } });
  if (!invoice) throw new Error("Fatura não encontrada.");

  return prisma.transaction.create({
    data: {
      userId,
      kind: "CARD_ADJUSTMENT",
      description: input.reason,
      amountCents: input.amountCents,
      competenceDate: toPrismaDate(input.competenceDate),
      cardId: invoice.cardId,
      invoiceId: invoice.id,
      method: "CARD",
      externalId: input.externalId ?? null,
      importBatchId: input.importBatchId ?? null,
    },
  });
}
