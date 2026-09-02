"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import {
  assertDateNotBeforeOpening,
  createExpenseOrIncomeCore,
  createInvestmentMoveCore,
  createTransferCore,
} from "./transaction-core";
import { toPrismaDate } from "./clock";

const NewTransactionInput = z
  .object({
    kind: z.enum(["EXPENSE", "INCOME"]),
    description: z.string().min(1, "Descrição obrigatória."),
    amountCents: centsPositive,
    competenceDate: z.string().min(1, "Data obrigatória."),
    categoryId: z.string().min(1, "Categoria obrigatória."),
    method: z.enum(["ACCOUNT", "CARD"]),
    accountId: z.string().nullable().optional(),
    cardId: z.string().nullable().optional(),
    installments: z.number().int().min(1).max(48).default(1),
    isFixed: z.boolean().default(false),
    note: z.string().nullable().optional(),
  })
  .refine((data) => (data.method === "ACCOUNT" ? !!data.accountId : !!data.cardId), {
    message: "Conta ou cartão obrigatório.",
    path: ["accountId"],
  });

export type NewTransactionData = z.input<typeof NewTransactionInput>;

export async function createTransaction(input: NewTransactionData) {
  const userId = await requireUserId();
  const data = NewTransactionInput.parse(input);

  if (data.method === "ACCOUNT") {
    await assertDateNotBeforeOpening(userId, data.accountId!, data.competenceDate);
  }

  const created = await createExpenseOrIncomeCore(userId, data);

  revalidatePath("/transactions");
  revalidatePath("/");
  return created;
}

const TransferInput = z.object({
  accountId: z.string().min(1, "Conta de origem obrigatória."),
  toAccountId: z.string().min(1, "Conta de destino obrigatória."),
  amountCents: centsPositive,
  competenceDate: z.string().min(1, "Data obrigatória."),
  note: z.string().nullable().optional(),
});

export async function createTransfer(input: z.input<typeof TransferInput>) {
  const userId = await requireUserId();
  const data = TransferInput.parse(input);

  if (data.accountId === data.toAccountId) {
    throw new Error("A conta de origem e destino devem ser diferentes.");
  }
  await assertDateNotBeforeOpening(userId, data.accountId, data.competenceDate);
  await assertDateNotBeforeOpening(userId, data.toAccountId, data.competenceDate);

  const transaction = await createTransferCore(userId, data);

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
  return transaction;
}

const InvestmentMoveInput = z.object({
  kind: z.enum(["INVESTMENT_IN", "INVESTMENT_OUT"]),
  investmentId: z.string().min(1, "Investimento obrigatório."),
  accountId: z.string().min(1, "Conta obrigatória."),
  amountCents: centsPositive,
  competenceDate: z.string().min(1, "Data obrigatória."),
});

/** Aportar/Resgatar (R1 — never counts as income/expense). */
export async function createInvestmentMove(input: z.input<typeof InvestmentMoveInput>) {
  const userId = await requireUserId();
  const data = InvestmentMoveInput.parse(input);

  await assertDateNotBeforeOpening(userId, data.accountId, data.competenceDate);
  const transaction = await createInvestmentMoveCore(userId, data);

  revalidatePath("/investments");
  revalidatePath("/accounts");
  revalidatePath("/");
  return transaction;
}

export async function deleteTransaction(id: string) {
  const userId = await requireUserId();
  await prisma.transaction.deleteMany({ where: { id, userId } });
  revalidatePath("/transactions");
  revalidatePath("/");
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  kind?: string;
  from?: string;
  to?: string;
}

export async function listTransactions(filters: TransactionFilters = {}) {
  const userId = await requireUserId();
  return prisma.transaction.findMany({
    where: {
      userId,
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.kind ? { kind: filters.kind as never } : {}),
      ...(filters.from || filters.to
        ? {
            competenceDate: {
              ...(filters.from ? { gte: toPrismaDate(filters.from) } : {}),
              ...(filters.to ? { lte: toPrismaDate(filters.to) } : {}),
            },
          }
        : {}),
    },
    include: { category: true, account: true, card: true },
    orderBy: { competenceDate: "desc" },
  });
}

export async function getTransaction(id: string) {
  const userId = await requireUserId();
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: { category: true, account: true, toAccount: true, card: true, invoice: true },
  });
}
