"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsAny, centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { todayDateString, toPrismaDate } from "./clock";

const InvestmentInput = z.object({
  name: z.string().min(1, "Nome obrigatório."),
  kind: z.enum(["FIXED_INCOME", "TREASURY", "FUND", "STOCKS", "OTHER"]),
  accountId: z.string().min(1, "Conta obrigatória."),
  appliedCents: centsPositive,
  currentCents: centsAny,
  liquidity: z.string().nullable().optional(),
  /** Debits the contribution from the account now, as an INVESTMENT_IN (doesn't count as an expense — R1). */
  debitNow: z.boolean(),
});

export async function createInvestment(input: z.input<typeof InvestmentInput>) {
  const userId = await requireUserId();
  const data = InvestmentInput.parse(input);

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) throw new Error("Conta não encontrada.");

  const investment = await prisma.investment.create({
    data: {
      userId,
      accountId: data.accountId,
      name: data.name,
      kind: data.kind,
      appliedCents: data.appliedCents,
      currentCents: data.currentCents,
      liquidity: data.liquidity ?? null,
    },
  });

  if (data.debitNow) {
    await prisma.transaction.create({
      data: {
        userId,
        kind: "INVESTMENT_IN",
        description: `Aporte em ${data.name}`,
        amountCents: data.appliedCents,
        competenceDate: toPrismaDate(todayDateString()),
        accountId: data.accountId,
        investmentId: investment.id,
        method: "ACCOUNT",
      },
    });
  }

  revalidatePath("/investments");
  revalidatePath("/", "layout");
  return investment;
}

export async function listInvestments() {
  const userId = await requireUserId();
  return prisma.investment.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
  });
}

const UpdateInvestmentValueInput = z.object({
  id: z.string().min(1),
  currentCents: centsAny,
});

/**
 * Manual revaluation — the only way `currentCents` moves outside of a
 * contribution/withdrawal (which already keep it in sync automatically, see
 * createInvestmentMoveCore). Use this to reflect an actual market
 * return/loss, or to correct a value entered wrong.
 */
export async function updateInvestmentValue(input: z.input<typeof UpdateInvestmentValueInput>) {
  const userId = await requireUserId();
  const data = UpdateInvestmentValueInput.parse(input);

  await prisma.investment.updateMany({
    where: { id: data.id, userId },
    data: { currentCents: data.currentCents, lastValuationAt: toPrismaDate(todayDateString()) },
  });

  revalidatePath("/investments");
  revalidatePath("/", "layout");
}
