import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/server/session";
import { listAccounts } from "@/lib/server/accounts";
import { assignInvoice, calculateAvailableLimit, calculateOutstandingBalance } from "@/lib/finance/invoice";
import { addMonths } from "@/lib/finance/period";
import { isExpense } from "@/lib/finance/transactions";
import { formatBRL } from "@/lib/finance/money";
import { todayDateString } from "@/lib/server/clock";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ClickableTableRow } from "@/components/ui/ClickableTableRow";
import { PayInvoiceModal } from "@/components/finance/PayInvoiceModal";
import { AdjustInvoiceModal } from "@/components/finance/AdjustInvoiceModal";
import { EnterPastInvoiceModal } from "@/components/finance/EnterPastInvoiceModal";
import { UnpayInvoiceButton } from "@/components/finance/UnpayInvoiceButton";
import { DeleteManualInvoiceButton } from "@/components/finance/DeleteManualInvoiceButton";
import { getUnpaidInvoiceTotalCents } from "@/lib/server/invoices";

export default async function CardDetailPage({
  params,
  searchParams,
}: PageProps<"/cards/[id]">) {
  const { id } = await params;
  const search = await searchParams;
  const monthOffset = Number(search?.month ?? 0);

  const userId = await requireUserId();
  const card = await prisma.card.findFirst({ where: { id, userId } });
  if (!card) notFound();

  const [accounts, unpaidInvoiceTotalCents] = await Promise.all([
    listAccounts(),
    getUnpaidInvoiceTotalCents(userId, card.id),
  ]);

  const { availableCents, utilizationPercent } = calculateAvailableLimit({
    limitCents: card.limitCents,
    unpaidInvoiceTotalCents,
  });

  // Default view is the card's currently-open invoice (R3), not the raw calendar
  // month — those diverge whenever today is past closingDay this month.
  const openInvoiceMonth = assignInvoice(todayDateString(), card.closingDay, card.dueDay).referenceMonth;
  const targetMonth = addMonths(openInvoiceMonth, monthOffset);
  const referenceMonth = new Date(Date.UTC(targetMonth.year, targetMonth.month - 1, 1));

  const invoice = await prisma.invoice.findFirst({
    where: { userId, cardId: card.id, referenceMonth },
    include: { transactions: { orderBy: { competenceDate: "asc" }, include: { category: true } } },
  });

  const invoiceTotal = invoice
    ? invoice.manualTotalCents ?? invoice.transactions.reduce((s, t) => s + (isExpense(t.kind) ? t.amountCents : 0), 0)
    : 0;
  const outstanding = invoice ? calculateOutstandingBalance(invoiceTotal, invoice.paidCents) : 0;

  const monthLabel = referenceMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const referenceMonthStr = `${targetMonth.year}-${String(targetMonth.month).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">{card.name}</h1>
        <Link href={`/cards/${id}/invoices`} className="text-micro text-accent-300 hover:underline">
          Faturas projetadas
        </Link>
      </div>

      <Card className="gap-md">
        <div className="grid grid-cols-3 gap-md">
          <div className="flex flex-col gap-xs">
            <span className="text-label uppercase text-dim">Limite</span>
            <span className="tabular-money text-kpi-md text-text">{formatBRL(card.limitCents)}</span>
          </div>
          <div className="flex flex-col gap-xs">
            <span className="text-label uppercase text-dim">Comprometido</span>
            <span className="tabular-money text-kpi-md text-text">{formatBRL(unpaidInvoiceTotalCents)}</span>
          </div>
          <div className="flex flex-col gap-xs">
            <span className="text-label uppercase text-dim">Disponível</span>
            <span className="tabular-money text-kpi-md text-pos">{formatBRL(availableCents)}</span>
          </div>
        </div>
        <Bar
          percent={utilizationPercent}
          severity={utilizationPercent >= 100 ? "neg" : utilizationPercent >= 80 ? "warn" : "accent"}
        />
      </Card>

      <div className="flex items-center justify-between">
        <span className="capitalize text-row text-text">{monthLabel}</span>
        {invoice && invoiceTotal > 0 && outstanding > 0 ? (
          <div className="flex gap-md">
            <PayInvoiceModal invoiceId={invoice.id} outstandingCents={outstanding} accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname }))} />
            <AdjustInvoiceModal invoiceId={invoice.id} />
            {invoice.manualTotalCents !== null ? (
              <EnterPastInvoiceModal
                cardId={card.id}
                referenceMonth={referenceMonthStr}
                monthLabel={monthLabel}
                triggerLabel="Editar total"
                title="Editar total da fatura"
                defaultValueCents={invoice.manualTotalCents}
              />
            ) : null}
            {invoice.manualTotalCents !== null && invoice.transactions.length === 0 ? (
              <DeleteManualInvoiceButton invoiceId={invoice.id} />
            ) : null}
          </div>
        ) : invoice && invoiceTotal > 0 ? (
          <div className="flex items-center gap-md">
            <span className="text-micro text-pos">Fatura paga</span>
            <UnpayInvoiceButton invoiceId={invoice.id} />
            {invoice.manualTotalCents !== null ? (
              <EnterPastInvoiceModal
                cardId={card.id}
                referenceMonth={referenceMonthStr}
                monthLabel={monthLabel}
                triggerLabel="Editar total"
                title="Editar total da fatura"
                defaultValueCents={invoice.manualTotalCents}
              />
            ) : null}
          </div>
        ) : (
          // Covers both "no invoice row yet" and "an invoice row exists but is
          // still empty" (0 transactions, no manual total) — enterPastInvoice
          // upserts by cardId+referenceMonth, so the same action works for
          // both without falsely labeling an empty invoice "Fatura paga".
          <EnterPastInvoiceModal cardId={card.id} referenceMonth={referenceMonthStr} monthLabel={monthLabel} />
        )}
      </div>

      {invoice && invoice.transactions.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell>Categoria</TableHeaderCell>
              <TableHeaderCell className="text-right">Valor</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.transactions.map((t) => (
              <ClickableTableRow key={t.id} href={`/transactions/${t.id}`}>
                <TableCell className="text-muted">{t.competenceDate.toISOString().slice(0, 10)}</TableCell>
                <TableCell className="text-text">{t.description}</TableCell>
                <TableCell className="text-muted">{t.category?.name ?? "—"}</TableCell>
                <TableCell className="tabular-money text-right text-text">{formatBRL(t.amountCents)}</TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-micro text-dim">Nenhum lançamento nesta fatura.</p>
      )}

      {invoice ? (
        <div className="flex items-center justify-between border-t border-line pt-sm text-row">
          <span className="text-dim">Total da fatura</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(invoiceTotal)}</span>
        </div>
      ) : null}
    </div>
  );
}
