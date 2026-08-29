"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsAny, centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";
import { addMonths, formatDateParts, getFinancialMonth, parseDateParts } from "@/lib/finance/period";
import { calculateFreeToSpend, calculateGoalPace, type GoalPaceResult } from "@/lib/finance/goals";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import type { FinanceTransaction } from "@/lib/finance/types";

const GoalInput = z
  .object({
    name: z.string().min(1, "Nome obrigatório."),
    icon: z.string().min(1, "Ícone obrigatório."),
    targetCents: centsPositive,
    targetDate: z.string().nullable().optional(),
    monthlyTargetCents: centsAny.nullable().optional(),
    accountId: z.string().nullable().optional(),
    investmentId: z.string().nullable().optional(),
  })
  .refine((d) => !!d.accountId || !!d.investmentId, {
    message: "Escolha uma conta ou investimento para guardar o porquinho.",
    path: ["accountId"],
  });

export async function createGoal(input: z.input<typeof GoalInput>) {
  const userId = await requireUserId();
  const data = GoalInput.parse(input);

  await prisma.goal.create({
    data: {
      userId,
      name: data.name,
      icon: data.icon,
      targetCents: data.targetCents,
      targetDate: data.targetDate ? toPrismaDate(data.targetDate) : null,
      monthlyTargetCents: data.monthlyTargetCents ?? null,
      accountId: data.accountId || null,
      investmentId: data.investmentId || null,
    },
  });

  revalidatePath("/goals");
  revalidatePath("/");
}

export interface GoalWithProgress {
  id: string;
  name: string;
  icon: string;
  targetCents: number;
  targetDate: string | null;
  savedCents: number;
  accountId: string | null;
  investmentId: string | null;
  pace: GoalPaceResult | null;
}

async function goalProgress(goalId: string, today: string, monthStartDay: number) {
  const moves = await prisma.transaction.findMany({ where: { goalId } });
  const savedCents = moves.reduce((s, t) => s + (t.kind === "GOAL_IN" ? t.amountCents : -t.amountCents), 0);

  let sum = 0;
  const currentMonth = getFinancialMonth(today, monthStartDay);
  for (let i = 1; i <= 3; i++) {
    const cal = addMonths(parseDateParts(currentMonth.start), -i);
    const anchorDate = formatDateParts({ ...cal, day: 15 });
    const fm = getFinancialMonth(anchorDate, monthStartDay);
    sum += moves
      .filter((t) => t.kind === "GOAL_IN")
      .filter((t) => {
        const d = t.competenceDate.toISOString().slice(0, 10);
        return d >= fm.start && d < fm.end;
      })
      .reduce((s, t) => s + t.amountCents, 0);
  }
  const avgContributionCents = Math.round(sum / 3);

  return { savedCents, avgContributionCents };
}

export async function listGoalsWithProgress(): Promise<{ goals: GoalWithProgress[]; availableCents: number; reservedCents: number; freeToSpendCents: number }> {
  const userId = await requireUserId();
  const today = todayDateString();

  const [settings, accounts, goals, allTransactions] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.account.findMany({ where: { userId, archivedAt: null, includeInTotals: true } }),
    prisma.goal.findMany({ where: { userId, closedAt: null } }),
    prisma.transaction.findMany({ where: { userId } }),
  ]);

  const financeTx: FinanceTransaction[] = allTransactions.map((t) => ({
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

  const availableCents = accounts.reduce(
    (sum, a) => sum + calculateAccountBalance(a.id, a.openingBalance, financeTx, today),
    0
  );

  const results: GoalWithProgress[] = [];
  for (const goal of goals) {
    const { savedCents, avgContributionCents } = await goalProgress(goal.id, today, settings.monthStartDay);
    const pace = calculateGoalPace({
      targetCents: goal.targetCents,
      currentBalanceCents: savedCents,
      targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
      today,
      avgContributionCents,
    });
    results.push({
      id: goal.id,
      name: goal.name,
      icon: goal.icon,
      targetCents: goal.targetCents,
      targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
      savedCents,
      accountId: goal.accountId,
      investmentId: goal.investmentId,
      pace,
    });
  }

  const reservedCents = results.filter((g) => g.accountId).reduce((s, g) => s + g.savedCents, 0);
  const freeToSpendCents = calculateFreeToSpend(
    availableCents,
    results.map((g) => ({ savedCents: g.savedCents, accountId: g.accountId }))
  );

  return { goals: results, availableCents, reservedCents, freeToSpendCents };
}

export async function getGoal(id: string) {
  const userId = await requireUserId();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const goal = await prisma.goal.findFirst({
    where: { id, userId },
    include: {
      transactions: { orderBy: { competenceDate: "desc" } },
      account: true,
      investment: true,
    },
  });
  if (!goal) return null;

  const today = todayDateString();
  const { savedCents, avgContributionCents } = await goalProgress(goal.id, today, settings.monthStartDay);
  const pace = calculateGoalPace({
    targetCents: goal.targetCents,
    currentBalanceCents: savedCents,
    targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
    today,
    avgContributionCents,
  });

  return { goal, savedCents, pace };
}

const GoalMoveInput = z.object({
  goalId: z.string().min(1),
  amountCents: centsPositive,
  competenceDate: z.string().min(1),
});

/** Guardar (save) — a logical reserve, doesn't touch account balance (R1/R9). */
export async function contributeToGoal(input: z.input<typeof GoalMoveInput>) {
  const userId = await requireUserId();
  const data = GoalMoveInput.parse(input);
  const goal = await prisma.goal.findFirst({ where: { id: data.goalId, userId } });
  if (!goal) throw new Error("Porquinho não encontrado.");

  await prisma.transaction.create({
    data: {
      userId,
      kind: "GOAL_IN",
      description: `Guardado em ${goal.name}`,
      amountCents: data.amountCents,
      competenceDate: toPrismaDate(data.competenceDate),
      goalId: goal.id,
      accountId: goal.accountId,
      method: goal.accountId ? "ACCOUNT" : undefined,
    },
  });

  revalidatePath("/goals");
  revalidatePath(`/goals/${goal.id}`);
  revalidatePath("/");
}

/** Resgatar (withdraw) from the reserve. */
export async function withdrawFromGoal(input: z.input<typeof GoalMoveInput>) {
  const userId = await requireUserId();
  const data = GoalMoveInput.parse(input);
  const goal = await prisma.goal.findFirst({ where: { id: data.goalId, userId } });
  if (!goal) throw new Error("Porquinho não encontrado.");

  await prisma.transaction.create({
    data: {
      userId,
      kind: "GOAL_OUT",
      description: `Resgatado de ${goal.name}`,
      amountCents: data.amountCents,
      competenceDate: toPrismaDate(data.competenceDate),
      goalId: goal.id,
      accountId: goal.accountId,
      method: goal.accountId ? "ACCOUNT" : undefined,
    },
  });

  revalidatePath("/goals");
  revalidatePath(`/goals/${goal.id}`);
  revalidatePath("/");
}
