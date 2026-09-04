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

const HideAmountsInput = z.object({ hideAmounts: z.boolean() });

/**
 * Quick eye-icon toggle in the topbar — separate from the full preferences
 * form. No revalidatePath: AppShell already applies the value optimistically
 * and stays mounted across client-side navigation, so a forced refetch of
 * the whole layout (accounts/cards/categories/investments/settings) on every
 * click would only add latency and a window for stale data to flip it back.
 * The write still persists for the next full page load.
 */
export async function setHideAmounts(input: z.input<typeof HideAmountsInput>) {
  const userId = await requireUserId();
  const { hideAmounts } = HideAmountsInput.parse(input);

  await prisma.settings.update({ where: { userId }, data: { hideAmounts } });
}
