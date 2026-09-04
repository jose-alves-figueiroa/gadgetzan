"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsAny } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";

const AccountInput = z.object({
  institution: z.string().min(1, "Instituição obrigatória."),
  nickname: z.string().min(1, "Apelido obrigatório."),
  type: z.enum(["CHECKING", "SAVINGS", "PAYMENT"]),
  openingBalance: centsAny,
  openingDate: z.string().min(1, "Data obrigatória."),
  includeInTotals: z.boolean(),
});

export async function createAccount(input: z.input<typeof AccountInput>) {
  const userId = await requireUserId();
  const data = AccountInput.parse(input);

  const account = await prisma.account.create({
    data: {
      userId,
      institution: data.institution,
      nickname: data.nickname,
      type: data.type,
      openingBalance: data.openingBalance,
      openingDate: toPrismaDate(data.openingDate),
      includeInTotals: data.includeInTotals,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/", "layout"); // AppShell's account/card/category/investment lists are fetched at the root (app) layout
  return account;
}

export async function listAccounts() {
  const userId = await requireUserId();
  return prisma.account.findMany({
    where: { userId, archivedAt: null },
    orderBy: { nickname: "asc" },
  });
}

export async function archiveAccount(id: string) {
  const userId = await requireUserId();
  await prisma.account.updateMany({ where: { id, userId }, data: { archivedAt: toPrismaDate(todayDateString()) } });

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
}

const UpdateOpeningBalanceInput = z.object({
  id: z.string().min(1),
  openingBalance: centsAny,
  openingDate: z.string().min(1, "Data obrigatória."),
});

/**
 * Corrects the account's starting point. Every balance/net-worth figure is
 * derived live from openingBalance + transactions since openingDate (R12) —
 * this is the only way to fix a wrong initial value after the fact, and it
 * retroactively changes every historical figure derived from it.
 */
export async function updateAccountOpeningBalance(input: z.input<typeof UpdateOpeningBalanceInput>) {
  const userId = await requireUserId();
  const data = UpdateOpeningBalanceInput.parse(input);

  const account = await prisma.account.findFirst({ where: { id: data.id, userId } });
  if (!account) throw new Error("Conta não encontrada.");

  // Mirrors assertDateNotBeforeOpening (transaction-core.ts): a transaction
  // can't predate the account's opening — moving openingDate past one that
  // already exists would silently break that invariant.
  const earlierTransaction = await prisma.transaction.findFirst({
    where: {
      userId,
      OR: [{ accountId: data.id }, { toAccountId: data.id }],
      competenceDate: { lt: toPrismaDate(data.openingDate) },
    },
  });
  if (earlierTransaction) {
    throw new Error("Já existe lançamento antes dessa data nessa conta — escolha uma data igual ou anterior a ele.");
  }

  await prisma.account.update({
    where: { id: data.id },
    data: { openingBalance: data.openingBalance, openingDate: toPrismaDate(data.openingDate) },
  });

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
}
