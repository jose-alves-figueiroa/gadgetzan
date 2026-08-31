"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";
import { DEFAULT_CATEGORIES } from "./default-categories";

const CategoryInput = z.object({
  name: z.string().min(1, "Nome obrigatório."),
  nature: z.enum(["FIXED", "VARIABLE", "COMMITMENT", "INCOME"]),
  icon: z.string().min(1, "Ícone obrigatório."),
  /** Optional — creates a companion category-scoped Limit alongside the category (2d). */
  limitAmountCents: centsPositive.nullable().optional(),
});

export async function createCategory(input: z.input<typeof CategoryInput>) {
  const userId = await requireUserId();
  const data = CategoryInput.parse(input);

  const category = await prisma.category.create({
    data: { userId, name: data.name, nature: data.nature, icon: data.icon },
  });

  if (data.limitAmountCents) {
    await prisma.limit.create({
      data: {
        userId,
        scope: "CATEGORY",
        categoryId: category.id,
        amountCents: data.limitAmountCents,
      },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return category;
}

const CategoryUpdateInput = z.object({
  name: z.string().min(1, "Nome obrigatório."),
  nature: z.enum(["FIXED", "VARIABLE", "COMMITMENT", "INCOME"]),
  icon: z.string().min(1, "Ícone obrigatório."),
});

export async function updateCategory(id: string, input: z.input<typeof CategoryUpdateInput>) {
  const userId = await requireUserId();
  const data = CategoryUpdateInput.parse(input);

  await prisma.category.updateMany({
    where: { id, userId },
    data: { name: data.name, nature: data.nature, icon: data.icon },
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function archiveCategory(id: string) {
  const userId = await requireUserId();
  await prisma.category.updateMany({ where: { id, userId }, data: { archivedAt: toPrismaDate(todayDateString()) } });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function listCategories() {
  const userId = await requireUserId();
  return prisma.category.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
  });
}

/** Idempotent — creates any of the default categories the user doesn't already have. */
export async function ensureDefaultCategories() {
  const userId = await requireUserId();
  const existing = await prisma.category.findMany({ where: { userId }, select: { name: true } });
  const existingNames = new Set(existing.map((c) => c.name));

  const missing = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name));
  if (missing.length === 0) return;

  await prisma.category.createMany({ data: missing.map((c) => ({ ...c, userId })) });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}
