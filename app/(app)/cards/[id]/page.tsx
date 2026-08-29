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
import { PayInvoiceModal } from "@/components/finance/PayInvoiceModal";
import { AdjustInvoiceModal } from "@/components/finance/AdjustInvoiceModal";

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

  const [accounts, unpaidAgg] = await Promise.all([
    listAccounts(),
    prisma.transaction.aggregate({
      where: { userId, cardId: card.id, invoice: { paidAt: null } },
      _sum: { amountCents: true },
    }),
  ]);

  const { availableCents, utilizationPercent } = calculateAvailableLimit({
    limitCents: card.limitCents,
    unpaidInvoiceTotalCents: unpaidAgg._sum.amountCents ?? 0,
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

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="text-title text-text">{card.name}</h1>

      <Card className="gap-md">
        <div className="flex items-center justify-between text-row">
          <span className="text-dim">Limite</span>
          <span className="tabular-money text-text">{formatBRL(card.limitCents)}</span>
        </div>
        <div className="flex items-center justify-between text-row">
          <span className="text-dim">Disponível</span>
          <span className="tabular-money text-text">{formatBRL(availableCents)}</span>
        </div>
        <Bar
          percent={utilizationPercent}
          severity={utilizationPercent >= 100 ? "neg" : utilizationPercent >= 80 ? "warn" : "accent"}
        />
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-md text-row">
          <Link href={`/cards/${id}?month=${monthOffset - 1}`} className="text-dim hover:text-text">
            ‹
          </Link>
          <span className="capitalize text-text">{monthLabel}</span>
          <Link href={`/cards/${id}?month=${monthOffset + 1}`} className="text-dim hover:text-text">
            ›
          </Link>
        </div>
        {invoice && outstanding > 0 ? (
          <div className="flex gap-md">
            <PayInvoiceModal invoiceId={invoice.id} outstandingCents={outstanding} accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname }))} />
            <AdjustInvoiceModal invoiceId={invoice.id} />
          </div>
        ) : invoice ? (
          <span className="text-micro text-pos">Fatura paga</span>
        ) : null}
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
              <TableRow key={t.id}>
                <TableCell className="text-muted">{t.competenceDate.toISOString().slice(0, 10)}</TableCell>
                <TableCell className="text-text">{t.description}</TableCell>
                <TableCell className="text-muted">{t.category?.name ?? "—"}</TableCell>
                <TableCell className="tabular-money text-right text-text">{formatBRL(t.amountCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-micro text-dim">Nenhum lançamento nesta fatura.</p>
      )}
    </div>
  );
}
