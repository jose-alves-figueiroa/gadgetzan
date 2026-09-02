import { prisma } from "@/lib/db";
import { calculateOutstandingBalance } from "@/lib/finance/invoice";
import { sumInvoiceChargeCents } from "../transaction-core";
import { toPrismaDate, todayDateString } from "../clock";

export interface UndoResult {
  deletedTransactions: number;
  deletedInvoices: number;
  deletedPurchases: number;
}

/**
 * Undo (R15) — recompute, don't reverse a delta. Deletes every transaction
 * tagged with the batch, then recomputes each affected invoice's
 * paidCents/paidAt purely from what's left (never subtracting a stored
 * delta), matching the same charge/payment split as applyInvoicePaymentCore.
 * Idempotent: batch status guards against a double-undo.
 */
export async function undoImportBatch(userId: string, batchId: string): Promise<UndoResult> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, userId } });
  if (!batch) throw new Error("Lote não encontrado.");
  if (batch.status === "UNDONE") throw new Error("Este lote já foi desfeito.");

  const transactions = await prisma.transaction.findMany({
    where: { importBatchId: batchId, userId },
    select: { invoiceId: true, purchaseId: true },
  });
  const invoiceIds = [...new Set(transactions.map((t) => t.invoiceId).filter((id): id is string => Boolean(id)))];
  const purchaseIds = [...new Set(transactions.map((t) => t.purchaseId).filter((id): id is string => Boolean(id)))];

  const { count: deletedTransactions } = await prisma.transaction.deleteMany({
    where: { importBatchId: batchId, userId },
  });

  let deletedInvoices = 0;
  for (const invoiceId of invoiceIds) {
    deletedInvoices += (await recomputeOrDeleteInvoice(invoiceId)) ? 1 : 0;
  }

  let deletedPurchases = 0;
  for (const purchaseId of purchaseIds) {
    const remaining = await prisma.transaction.count({ where: { purchaseId } });
    if (remaining === 0) {
      await prisma.purchase.delete({ where: { id: purchaseId } });
      deletedPurchases++;
    }
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "UNDONE", undoneAt: toPrismaDate(todayDateString()) },
  });

  return { deletedTransactions, deletedInvoices, deletedPurchases };
}

/** Returns true if the invoice was deleted (no remaining transactions, no manual total). */
async function recomputeOrDeleteInvoice(invoiceId: string): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return false;

  const remainingCount = await prisma.transaction.count({ where: { invoiceId } });
  if (remainingCount === 0 && invoice.manualTotalCents == null) {
    await prisma.invoice.delete({ where: { id: invoiceId } });
    return true;
  }

  const totalCents = invoice.manualTotalCents ?? (await sumInvoiceChargeCents(invoiceId));
  const remainingPayments = await prisma.transaction.findMany({
    where: { invoiceId, kind: "CARD_PAYMENT" },
    select: { amountCents: true, competenceDate: true },
  });
  const paidCents = remainingPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const lastPaymentDate = remainingPayments.reduce<Date | null>(
    (max, p) => (!max || p.competenceDate > max ? p.competenceDate : max),
    null
  );
  const settled = paidCents > 0 && calculateOutstandingBalance(totalCents, paidCents) === 0;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidCents: paidCents > 0 ? paidCents : null,
      paidAt: settled ? lastPaymentDate : null,
    },
  });
  return false;
}
