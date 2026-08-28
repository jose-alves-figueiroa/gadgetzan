"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";

/** closingDay/dueDay between 1 and 28 (05 § Form validations). */
const CardInput = z.object({
  accountId: z.string().min(1, "Conta obrigatória."),
  name: z.string().min(1, "Nome obrigatório."),
  limitCents: centsPositive,
  closingDay: z.number().int().min(1).max(28),
  dueDay: z.number().int().min(1).max(28),
  utilizationTarget: z.number().int().min(1).max(100).nullable().optional(),
});

export async function createCard(input: z.input<typeof CardInput>) {
  const userId = await requireUserId();
  const data = CardInput.parse(input);

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } });
  if (!account) throw new Error("Conta não encontrada.");

  const card = await prisma.card.create({
    data: {
      userId,
      accountId: data.accountId,
      name: data.name,
      limitCents: data.limitCents,
      closingDay: data.closingDay,
      dueDay: data.dueDay,
      utilizationTarget: data.utilizationTarget ?? null,
    },
  });

  revalidatePath("/cards");
  return card;
}

export async function listCards() {
  const userId = await requireUserId();
  return prisma.card.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
  });
}
