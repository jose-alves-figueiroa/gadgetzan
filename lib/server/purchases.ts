"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { toPrismaDate } from "./clock";
import { calculateOutstandingBalance, groupRemainingInstallmentsByInvoice } from "@/lib/finance/invoice";

export async function getPurchase(id: string) {
  const userId = await requireUserId();
  const purchase = await prisma.purchase.findFirst({
    where: { id, userId },
    include: {
      card: true,
      category: true,
      transactions: {
        orderBy: { installmentNo: "asc" },
        include: { invoice: true },
      },
    },
  });
  return purchase;
}

const PayRemainingInput = z.object({
  purchaseId: z.string().min(1),
  accountId: z.string().min(1, "Conta obrigatória."),
  paidDate: z.string().min(1, "Data obrigatória."),
});

/**
 * Settles every not-yet-paid installment of a purchase today (or on a chosen
 * date) instead of waiting for each installment's invoice to come due.
 * Installments stay recorded on their original months (R3 accrual basis) —
 * this only moves the cash-out, via the same CARD_PAYMENT + Invoice.paidCents
 * mechanism as paying a regular invoice (invoice-operations.ts), just applied
 * across every invoice this purchase still owes money on.
 */
export async function payPurchaseRemaining(input: z.input<typeof PayRemainingInput>) {
  const userId = await requireUserId();
  const data = PayRemainingInput.parse(input);

  const purchase = await prisma.purchase.findFirst({
    where: { id: data.purchaseId, userId },
    include: { transactions: { include: { invoice: true } } },
  });
  if (!purchase) throw new Error("Compra não encontrada.");

  const remaining = groupRemainingInstallmentsByInvoice(
    purchase.transactions.map((t) => ({
      invoiceId: t.invoiceId,
      amountCents: t.amountCents,
      invoicePaid: Boolean(t.invoice?.paidAt),
    }))
  );
  if (remaining.length === 0) throw new Error("Essa compra já está totalmente quitada.");

  const invoiceIds = remaining.map((r) => r.invoiceId);
  const [invoiceTotals, invoices] = await Promise.all([
    prisma.transaction.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invoiceIds } }, _sum: { amountCents: true } }),
    prisma.invoice.findMany({ where: { id: { in: invoiceIds } } }),
  ]);
  const invoiceTotalMap = new Map(invoiceTotals.map((r) => [r.invoiceId, r._sum.amountCents ?? 0]));
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const operations = remaining.flatMap(({ invoiceId, amountCents }) => {
    const invoice = invoiceMap.get(invoiceId)!;
    const invoiceTotalCents = invoice.manualTotalCents ?? invoiceTotalMap.get(invoiceId) ?? 0;
    const paidSoFarCents = (invoice.paidCents ?? 0) + amountCents;
    const settled = calculateOutstandingBalance(invoiceTotalCents, paidSoFarCents) === 0;

    return [
      prisma.transaction.create({
        data: {
          userId,
          kind: "CARD_PAYMENT",
          description: `Antecipação — ${purchase.description}`,
          amountCents,
          competenceDate: toPrismaDate(data.paidDate),
          accountId: data.accountId,
          invoiceId,
          method: "ACCOUNT",
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidCents: paidSoFarCents,
          paidAt: settled ? toPrismaDate(data.paidDate) : null,
        },
      }),
    ];
  });

  await prisma.$transaction(operations);

  revalidatePath(`/purchases/${data.purchaseId}`);
  revalidatePath("/cards");
  revalidatePath("/accounts");
  revalidatePath("/");
}
