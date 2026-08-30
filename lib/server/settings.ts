"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isValidMonthStartDay } from "@/lib/finance/period";
import { requireUserId } from "./session";

const MonthStartDayInput = z.object({
  monthStartDay: z.number().int().refine(isValidMonthStartDay, "Dia deve estar entre 1 e 28."),
});

export async function updateMonthStartDay(input: z.input<typeof MonthStartDayInput>) {
  const userId = await requireUserId();
  const { monthStartDay } = MonthStartDayInput.parse(input);

  await prisma.settings.update({ where: { userId }, data: { monthStartDay } });
  revalidatePath("/", "layout");
}

export async function getSettings() {
  const userId = await requireUserId();
  return prisma.settings.findUniqueOrThrow({ where: { userId } });
}

const PreferencesInput = z.object({
  monthStartDay: z.number().int().refine(isValidMonthStartDay, "Dia deve estar entre 1 e 28."),
  projectionMonths: z.number().int().min(1).max(24),
  cardUtilizationTarget: z.number().int().min(1).max(100),
  hideAmounts: z.boolean(),
});

/** E7-S5 — the settings screen's non-category fields (1aa). */
export async function updatePreferences(input: z.input<typeof PreferencesInput>) {
  const userId = await requireUserId();
  const data = PreferencesInput.parse(input);

  await prisma.settings.update({ where: { userId }, data });
  revalidatePath("/", "layout");
}
