"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { assignInvoice } from "@/lib/finance/invoice";
import { buildInstallmentPlan } from "@/lib/finance/installments";
import { findOrCreateInvoice } from "./invoices";
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
  let created;

  if (data.method === "CARD") {
    const card = await prisma.card.findFirst({ where: { id: data.cardId!, userId } });
    if (!card) throw new Error("Cartão não encontrado.");

    if (data.installments > 1) {
      const plan = buildInstallmentPlan(
        data.amountCents,
        data.installments,
        data.competenceDate,
        card.closingDay,
        card.dueDay
      );

      const purchase = await prisma.purchase.create({
        data: {
          userId,
          description: data.description,
          totalCents: data.amountCents,
          installments: data.installments,
          cardId: card.id,
          categoryId: data.categoryId,
          purchaseDate: toPrismaDate(data.competenceDate),
        },
      });

      for (const item of plan) {
        const invoice = await findOrCreateInvoice(userId, card, item.referenceMonth, item.dueDate);
        const tx = await prisma.transaction.create({
          data: {
            userId,
            kind: "EXPENSE",
            description: `${data.description} (${item.installmentNo}/${data.installments})`,
            amountCents: item.amountCents,
            competenceDate: toPrismaDate(data.competenceDate),
            categoryId: data.categoryId,
            method: "CARD",
            cardId: card.id,
            invoiceId: invoice.id,
            purchaseId: purchase.id,
            installmentNo: item.installmentNo,
            isFixed: data.isFixed,
            note: data.note ?? null,
          },
        });
        if (item.installmentNo === 1) created = tx;
      }
    } else {
      const assignment = assignInvoice(data.competenceDate, card.closingDay, card.dueDay);
      const invoice = await findOrCreateInvoice(userId, card, assignment.referenceMonth, assignment.dueDate);
      created = await prisma.transaction.create({
        data: {
          userId,
          kind: data.kind,
          description: data.description,
          amountCents: data.amountCents,
          competenceDate: toPrismaDate(data.competenceDate),
          categoryId: data.categoryId,
          method: "CARD",
          cardId: card.id,
          invoiceId: invoice.id,
          isFixed: data.isFixed,
          note: data.note ?? null,
        },
      });
    }
  } else {
    created = await prisma.transaction.create({
      data: {
        userId,
        kind: data.kind,
        description: data.description,
        amountCents: data.amountCents,
        competenceDate: toPrismaDate(data.competenceDate),
        categoryId: data.categoryId,
        method: "ACCOUNT",
        accountId: data.accountId,
        isFixed: data.isFixed,
        note: data.note ?? null,
      },
    });
  }

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

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      kind: "TRANSFER",
      description: "Transferência entre contas",
      amountCents: data.amountCents,
      competenceDate: data.competenceDate,
      accountId: data.accountId,
      toAccountId: data.toAccountId,
      method: "ACCOUNT",
      note: data.note ?? null,
    },
  });

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

  const investment = await prisma.investment.findFirst({ where: { id: data.investmentId, userId } });
  if (!investment) throw new Error("Investimento não encontrado.");

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      kind: data.kind,
      description: data.kind === "INVESTMENT_IN" ? `Aporte em ${investment.name}` : `Resgate de ${investment.name}`,
      amountCents: data.amountCents,
      competenceDate: data.competenceDate,
      accountId: data.accountId,
      investmentId: data.investmentId,
      method: "ACCOUNT",
    },
  });

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
