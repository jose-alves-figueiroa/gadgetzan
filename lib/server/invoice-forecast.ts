import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";
import { addDays, addMonths, formatDateParts, monthLabel } from "@/lib/finance/period";
import { assignInvoice, closingForReferenceMonth } from "@/lib/finance/invoice";
import { generateOccurrences } from "@/lib/finance/recurrence";
import { isExpense } from "@/lib/finance/transactions";

export interface InvoiceForecastRow {
  year: number;
  month: number;
  label: string;
  comprasCents: number;
  parcelasCents: number;
  assinaturasCents: number;
  totalCents: number;
  status: "REALIZADO" | "CONFIRMADO" | "PROJETADO";
}

/**
 * Projected invoices for a card (screen 1e): Compras (one-off, stored,
 * never estimated for future months — R8), Parcelas (installments, already
 * materialized as Transaction rows at purchase time), Assinaturas (CARD-
 * method recurrences, generated on the fly since they aren't materialized
 * ahead of time).
 */
export async function getProjectedInvoices(cardId: string, monthsAhead = 6) {
  const userId = await requireUserId();
  const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
  if (!card) throw new Error("Cartão não encontrado.");

  const today = todayDateString();
  const startMonth = assignInvoice(today, card.closingDay, card.dueDay).referenceMonth;

  const rules = await prisma.recurrenceRule.findMany({
    where: { userId, cardId: card.id, method: "CARD", status: "ACTIVE" },
  });

  const rows: InvoiceForecastRow[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const target = addMonths(startMonth, i);
    const referenceMonthDate = toPrismaDate(formatDateParts({ ...target, day: 1 }));
    const invoice = await prisma.invoice.findUnique({
      where: { cardId_referenceMonth: { cardId: card.id, referenceMonth: referenceMonthDate } },
      include: { transactions: true },
    });

    let comprasCents = 0;
    let parcelasCents = 0;
    let assinaturasCents = 0;

    if (invoice) {
      // Only real spend counts — a paid invoice's CARD_PAYMENT row is also
      // linked via invoiceId and must never inflate the invoice's own total.
      for (const t of invoice.transactions) {
        if (!isExpense(t.kind)) continue;
        if (t.purchaseId) parcelasCents += t.amountCents;
        else if (t.recurrenceId) assinaturasCents += t.amountCents;
        else comprasCents += t.amountCents;
      }
    }

    const { closingMonth } = closingForReferenceMonth(target, card.closingDay, card.dueDay);
    const rangeStart = formatDateParts({ ...addMonths(closingMonth, -1), day: 1 });
    const rangeEnd = addDays(formatDateParts({ ...addMonths(closingMonth, 1), day: 1 }), -1);
    for (const rule of rules) {
      const dates = generateOccurrences(
        {
          frequency: rule.frequency,
          dayOfMonth: rule.dayOfMonth,
          weekday: rule.weekday,
          monthOfYear: rule.monthOfYear,
          startDate: rule.startDate.toISOString().slice(0, 10),
          endDate: rule.endDate ? rule.endDate.toISOString().slice(0, 10) : null,
          status: rule.status,
        },
        rangeStart,
        rangeEnd
      );
      for (const date of dates) {
        const assignment = assignInvoice(date, card.closingDay, card.dueDay);
        if (assignment.referenceMonth.year === target.year && assignment.referenceMonth.month === target.month) {
          assinaturasCents += rule.amountCents;
        }
      }
    }

    const totalCents = comprasCents + parcelasCents + assinaturasCents;
    const status: InvoiceForecastRow["status"] = invoice?.paidAt
      ? "REALIZADO"
      : totalCents > 0
        ? "CONFIRMADO"
        : "PROJETADO";

    rows.push({
      year: target.year,
      month: target.month,
      label: monthLabel(target),
      comprasCents,
      parcelasCents,
      assinaturasCents,
      totalCents,
      status,
    });
  }

  return { card, rows };
}
