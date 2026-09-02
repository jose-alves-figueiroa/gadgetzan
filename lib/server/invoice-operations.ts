"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { centsPositive } from "@/lib/validation/money";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";
import { adjustInvoiceCore, applyInvoicePaymentCore } from "./transaction-core";

const PayInvoiceInput = z.object({
  invoiceId: z.string().min(1),
  accountId: z.string().min(1, "Conta obrigatória."),
  paidCents: centsPositive,
  paidDate: z.string().min(1, "Data obrigatória."),
});

/** Pay (full or partial) — debits the account via a CARD_PAYMENT (R1: never an expense). */
export async function payInvoice(input: z.input<typeof PayInvoiceInput>) {
  const userId = await requireUserId();
  const data = PayInvoiceInput.parse(input);

  await applyInvoicePaymentCore(userId, data);

  revalidatePath("/cards");
  revalidatePath("/accounts");
  revalidatePath("/");
}

const AdjustInvoiceInput = z.object({
  invoiceId: z.string().min(1),
  amountCents: centsPositive,
  reason: z.string().min(1, "Motivo obrigatório."),
});

/** Adjust (interest, fees, chargeback) — goes straight to the invoice as CARD_ADJUSTMENT (counts as an expense — R1/R3). */
export async function adjustInvoice(input: z.input<typeof AdjustInvoiceInput>) {
  const userId = await requireUserId();
  const data = AdjustInvoiceInput.parse(input);

  await adjustInvoiceCore(userId, { ...data, competenceDate: todayDateString() });

  revalidatePath("/cards");
  revalidatePath("/");
}

const PastInvoiceInput = z.object({
  cardId: z.string().min(1),
  referenceMonth: z.string().min(1),
  totalCents: centsPositive,
});

/** Enter a past invoice — someone starting to use the app with an already-open invoice (2e). */
export async function enterPastInvoice(input: z.input<typeof PastInvoiceInput>) {
  const userId = await requireUserId();
  const data = PastInvoiceInput.parse(input);

  const card = await prisma.card.findFirst({ where: { id: data.cardId, userId } });
  if (!card) throw new Error("Cartão não encontrado.");

  const referenceMonthDate = toPrismaDate(`${data.referenceMonth}-01`);
  const { closingForReferenceMonth } = await import("@/lib/finance/invoice");
  const [year, month] = data.referenceMonth.split("-").map(Number);
  const { closingDate } = closingForReferenceMonth({ year, month }, card.closingDay, card.dueDay);
  const dueDate = `${data.referenceMonth}-${String(card.dueDay).padStart(2, "0")}`;

  await prisma.invoice.upsert({
    where: { cardId_referenceMonth: { cardId: card.id, referenceMonth: referenceMonthDate } },
    create: {
      userId,
      cardId: card.id,
      referenceMonth: referenceMonthDate,
      closingDate: toPrismaDate(closingDate),
      dueDate: toPrismaDate(dueDate),
      manualTotalCents: data.totalCents,
    },
    update: { manualTotalCents: data.totalCents },
  });

  revalidatePath("/cards");
}

export async function getInvoiceDetail(invoiceId: string) {
  const userId = await requireUserId();
  return prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { transactions: { orderBy: { competenceDate: "asc" }, include: { category: true } }, card: true },
  });
}

export async function getCardInvoiceForMonth(cardId: string, monthOffset: number) {
  const userId = await requireUserId();
  const now = new Date();
  now.setMonth(now.getMonth() + monthOffset);
  const referenceMonthDate = toPrismaDate(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );

  return prisma.invoice.findFirst({
    where: { userId, cardId, referenceMonth: referenceMonthDate },
    include: { transactions: { orderBy: { competenceDate: "asc" }, include: { category: true } } },
  });
}
