"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";
import { getFinancialMonth, addMonths, formatDateParts, parseDateParts } from "@/lib/finance/period";
import { calculateLimitUtilization, calculateTotalMonthSpend } from "@/lib/finance/limits";
import { calculateAvailableLimit } from "@/lib/finance/invoice";
import { isExpense } from "@/lib/finance/transactions";
import type { FinanceTransaction } from "@/lib/finance/types";

const LimitInput = z
  .object({
    scope: z.enum(["TOTAL_MONTH", "CATEGORY", "CARD_UTILIZATION"]),
    categoryId: z.string().nullable().optional(),
    cardId: z.string().nullable().optional(),
    amountCents: centsPositive.nullable().optional(),
    percentValue: z.number().int().min(1).max(100).nullable().optional(),
    warnAtPercent: z.number().int().min(1).max(100).default(80),
    includeCommitments: z.boolean().default(false),
  })
  .refine((d) => d.scope !== "CATEGORY" || !!d.categoryId, { message: "Categoria obrigatória.", path: ["categoryId"] })
  .refine((d) => d.scope !== "CARD_UTILIZATION" || !!d.cardId, { message: "Cartão obrigatório.", path: ["cardId"] })
  .refine((d) => d.scope !== "CARD_UTILIZATION" || !!d.percentValue, { message: "Meta obrigatória.", path: ["percentValue"] })
  .refine((d) => d.scope === "CARD_UTILIZATION" || !!d.amountCents, { message: "Valor obrigatório.", path: ["amountCents"] });

export async function createLimit(input: z.input<typeof LimitInput>) {
  const userId = await requireUserId();
  const data = LimitInput.parse(input);

  // One active limit per category/card (screen 1t shows a single card per entity).
  if (data.scope === "CATEGORY" && data.categoryId) {
    const existing = await prisma.limit.findFirst({
      where: { userId, scope: "CATEGORY", categoryId: data.categoryId, archivedAt: null },
    });
    if (existing) throw new Error("Esta categoria já tem um limite ativo.");
  }
  if (data.scope === "CARD_UTILIZATION" && data.cardId) {
    const existing = await prisma.limit.findFirst({
      where: { userId, scope: "CARD_UTILIZATION", cardId: data.cardId, archivedAt: null },
    });
    if (existing) throw new Error("Este cartão já tem uma meta de utilização ativa.");
  }
  if (data.scope === "TOTAL_MONTH") {
    const existing = await prisma.limit.findFirst({ where: { userId, scope: "TOTAL_MONTH", archivedAt: null } });
    if (existing) throw new Error("Já existe um limite total do mês ativo.");
  }

  const limit = await prisma.limit.create({
    data: {
      userId,
      scope: data.scope,
      categoryId: data.scope === "CATEGORY" ? data.categoryId : null,
      cardId: data.scope === "CARD_UTILIZATION" ? data.cardId : null,
      amountCents: data.scope === "CARD_UTILIZATION" ? null : data.amountCents,
      percent: data.scope === "CARD_UTILIZATION" ? data.percentValue : null,
      warnAtPercent: data.warnAtPercent,
      includeCommitments: data.includeCommitments,
    },
  });

  revalidatePath("/limits");
  revalidatePath("/");
  return limit;
}

export async function archiveLimit(id: string) {
  const userId = await requireUserId();
  await prisma.limit.updateMany({ where: { id, userId }, data: { archivedAt: toPrismaDate(todayDateString()) } });
  revalidatePath("/limits");
}

export interface LimitWithUsage {
  id: string;
  scope: "TOTAL_MONTH" | "CATEGORY" | "CARD_UTILIZATION";
  label: string;
  amountCents: number;
  warnAtPercent: number;
  spentCents: number;
  percent: number;
  status: "ok" | "warning" | "exceeded";
  contextNote: string;
}

export async function listLimitsWithUsage(): Promise<LimitWithUsage[]> {
  const userId = await requireUserId();
  const today = todayDateString();

  const [settings, limits, categories, cards, transactions] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.limit.findMany({ where: { userId, archivedAt: null }, include: { category: true, card: true } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
    prisma.transaction.findMany({ where: { userId } }),
  ]);

  const financeTx: FinanceTransaction[] = transactions.map((t) => ({
    id: t.id,
    kind: t.kind,
    amountCents: t.amountCents,
    competenceDate: t.competenceDate.toISOString().slice(0, 10),
    categoryId: t.categoryId,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    cardId: t.cardId,
    method: t.method,
  }));

  const month = getFinancialMonth(today, settings.monthStartDay);
  const monthTx = financeTx.filter((t) => t.competenceDate >= month.start && t.competenceDate < month.end);
  const financeCategories = categories.map((c) => ({ id: c.id, nature: c.nature }));

  const cardUnpaidTotals = new Map<string, number>();
  await Promise.all(
    cards.map(async (card) => {
      const agg = await prisma.transaction.aggregate({
        where: { userId, cardId: card.id, invoice: { paidAt: null }, kind: { in: ["EXPENSE", "CARD_ADJUSTMENT"] } },
        _sum: { amountCents: true },
      });
      cardUnpaidTotals.set(card.id, agg._sum.amountCents ?? 0);
    })
  );

  const results: LimitWithUsage[] = [];
  for (const limit of limits) {
    if (limit.scope === "TOTAL_MONTH") {
      const spent = calculateTotalMonthSpend(monthTx, financeCategories, limit.includeCommitments);
      const utilization = calculateLimitUtilization(spent, limit.amountCents ?? 0, limit.warnAtPercent);
      results.push({
        id: limit.id,
        scope: "TOTAL_MONTH",
        label: "Limite total do mês",
        amountCents: limit.amountCents ?? 0,
        warnAtPercent: limit.warnAtPercent,
        spentCents: utilization.spentCents,
        percent: utilization.percent,
        status: utilization.status,
        contextNote: limit.includeCommitments ? "Inclui compromissos" : "Não inclui compromissos",
      });
    } else if (limit.scope === "CATEGORY" && limit.categoryId) {
      const spent = monthTx
        .filter((t) => isExpense(t.kind) && t.categoryId === limit.categoryId)
        .reduce((s, t) => s + t.amountCents, 0);
      const utilization = calculateLimitUtilization(spent, limit.amountCents ?? 0, limit.warnAtPercent);
      const daysRemaining = Math.max(
        0,
        Math.ceil((new Date(`${month.end}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000)
      );
      results.push({
        id: limit.id,
        scope: "CATEGORY",
        label: limit.category?.name ?? "Categoria",
        amountCents: limit.amountCents ?? 0,
        warnAtPercent: limit.warnAtPercent,
        spentCents: utilization.spentCents,
        percent: utilization.percent,
        status: utilization.status,
        contextNote: `${daysRemaining} dias restantes`,
      });
    } else if (limit.scope === "CARD_UTILIZATION" && limit.cardId && limit.card) {
      const { utilizationPercent } = calculateAvailableLimit({
        limitCents: limit.card.limitCents,
        unpaidInvoiceTotalCents: cardUnpaidTotals.get(limit.cardId) ?? 0,
      });
      const target = limit.percent ?? limit.warnAtPercent;
      results.push({
        id: limit.id,
        scope: "CARD_UTILIZATION",
        label: `Utilização — ${limit.card.name}`,
        amountCents: limit.card.limitCents,
        warnAtPercent: limit.warnAtPercent,
        spentCents: Math.round((utilizationPercent / 100) * limit.card.limitCents),
        percent: (utilizationPercent / target) * 100,
        status: utilizationPercent >= target ? "exceeded" : utilizationPercent >= target * 0.9 ? "warning" : "ok",
        contextNote: `${Math.round(utilizationPercent)}% do limite do cartão (meta ${target}%)`,
      });
    }
  }

  return results;
}

/** Last `months` closed financial months' spend for the limit's scope (1u's 6-month bar history). */
export async function getLimitHistory(limitId: string, months = 6): Promise<number[]> {
  const userId = await requireUserId();
  const [settings, limit, transactions, categories] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.limit.findFirst({ where: { id: limitId, userId } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
  ]);
  if (!limit) return [];

  const financeTx: FinanceTransaction[] = transactions.map((t) => ({
    id: t.id,
    kind: t.kind,
    amountCents: t.amountCents,
    competenceDate: t.competenceDate.toISOString().slice(0, 10),
    categoryId: t.categoryId,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    cardId: t.cardId,
    method: t.method,
  }));
  const financeCategories = categories.map((c) => ({ id: c.id, nature: c.nature }));

  const today = todayDateString();
  const currentMonth = getFinancialMonth(today, settings.monthStartDay);

  const history: number[] = [];
  for (let i = months; i >= 1; i--) {
    const cal = addMonths(parseDateParts(currentMonth.start), -i);
    const anchorDate = formatDateParts({ ...cal, day: 15 });
    const fm = getFinancialMonth(anchorDate, settings.monthStartDay);
    const monthTx = financeTx.filter((t) => t.competenceDate >= fm.start && t.competenceDate < fm.end);

    if (limit.scope === "TOTAL_MONTH") {
      history.push(calculateTotalMonthSpend(monthTx, financeCategories, limit.includeCommitments));
    } else if (limit.scope === "CATEGORY" && limit.categoryId) {
      history.push(
        monthTx.filter((t) => isExpense(t.kind) && t.categoryId === limit.categoryId).reduce((s, t) => s + t.amountCents, 0)
      );
    } else {
      history.push(0);
    }
  }

  return history;
}
