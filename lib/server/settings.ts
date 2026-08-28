"use server";

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
}

export async function getSettings() {
  const userId = await requireUserId();
  return prisma.settings.findUniqueOrThrow({ where: { userId } });
}
