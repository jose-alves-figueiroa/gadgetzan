"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsAny } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { toPrismaDate } from "./clock";

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
