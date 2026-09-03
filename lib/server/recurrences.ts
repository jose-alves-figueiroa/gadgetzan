"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { todayDateString, toPrismaDate } from "./clock";

const RecurrenceInput = z
  .object({
    kind: z.enum(["INCOME", "EXPENSE", "INVESTMENT_IN"]),
    description: z.string().min(1, "Nome obrigatório."),
    amountCents: centsPositive,
    frequency: z.enum(["MONTHLY", "WEEKLY", "YEARLY"]),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    weekday: z.number().int().min(0).max(6).nullable().optional(),
    monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    investmentId: z.string().nullable().optional(),
    method: z.enum(["ACCOUNT", "CARD"]),
    accountId: z.string().nullable().optional(),
    cardId: z.string().nullable().optional(),
    startDate: z.string().min(1, "Data de início obrigatória."),
    endDate: z.string().nullable().optional(),
  })
  .refine((data) => data.kind === "INVESTMENT_IN" || !!data.categoryId, {
    message: "Categoria obrigatória.",
    path: ["categoryId"],
  })
  .refine((data) => data.kind !== "INVESTMENT_IN" || !!data.investmentId, {
    message: "Investimento obrigatório.",
    path: ["investmentId"],
  })
  .refine((data) => (data.method === "ACCOUNT" ? !!data.accountId : !!data.cardId), {
    message: "Conta ou cartão obrigatório conforme a forma de pagamento.",
    path: ["accountId"],
  });

export async function createRecurrenceRule(input: z.input<typeof RecurrenceInput>) {
  const userId = await requireUserId();
  const data = RecurrenceInput.parse(input);

  if (data.kind !== "INVESTMENT_IN") {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId!, userId } });
    if (!category) throw new Error("Categoria não encontrada.");
    const isIncomeCategory = category.nature === "INCOME";
    if (isIncomeCategory !== (data.kind === "INCOME")) {
      throw new Error(
        isIncomeCategory
          ? "Categoria de receita não pode ser usada em uma despesa."
          : "Categoria de despesa não pode ser usada em uma receita."
      );
    }
  }

  const rule = await prisma.recurrenceRule.create({
    data: {
      userId,
      kind: data.kind,
      description: data.description,
      amountCents: data.amountCents,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth ?? null,
      weekday: data.weekday ?? null,
      monthOfYear: data.monthOfYear ?? null,
      categoryId: data.kind === "INVESTMENT_IN" ? null : data.categoryId,
      investmentId: data.kind === "INVESTMENT_IN" ? data.investmentId : null,
      method: data.method,
      accountId: data.method === "ACCOUNT" ? data.accountId : null,
      cardId: data.method === "CARD" ? data.cardId : null,
      startDate: toPrismaDate(data.startDate),
      endDate: data.endDate ? toPrismaDate(data.endDate) : null,
      status: "ACTIVE",
    },
  });

  revalidatePath("/recurrences");
  revalidatePath("/future");
  revalidatePath("/calendar");
  return rule;
}

export async function pauseRecurrenceRule(id: string) {
  const userId = await requireUserId();
  await prisma.recurrenceRule.updateMany({ where: { id, userId }, data: { status: "PAUSED" } });
  revalidatePath("/recurrences");
}

export async function endRecurrenceRule(id: string) {
  const userId = await requireUserId();
  await prisma.recurrenceRule.updateMany({
    where: { id, userId },
    data: { status: "ENDED", endDate: toPrismaDate(todayDateString()) },
  });
  revalidatePath("/recurrences");
}

export async function listRecurrenceRules() {
  const userId = await requireUserId();
  return prisma.recurrenceRule.findMany({
    where: { userId },
    include: { category: true, investment: true },
    orderBy: { description: "asc" },
  });
}
