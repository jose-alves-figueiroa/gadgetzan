import Link from "next/link";
import { notFound } from "next/navigation";
import { getTransaction } from "@/lib/server/transactions";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/server/session";
import { formatBRL } from "@/lib/finance/money";
import { calculateLimitUtilization } from "@/lib/finance/limits";
import { getFinancialMonth } from "@/lib/finance/period";
import { toPrismaDate } from "@/lib/server/clock";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { TransactionActions } from "@/components/finance/TransactionActions";

export default async function TransactionDetailPage({ params }: PageProps<"/transactions/[id]">) {
  const { id } = await params;
  const transaction = await getTransaction(id);
  if (!transaction) notFound();

  const userId = await requireUserId();

  let limitBar: { spentCents: number; amountCents: number; percent: number } | null = null;
  if (transaction.categoryId) {
    const limit = await prisma.limit.findFirst({
      where: { userId, scope: "CATEGORY", categoryId: transaction.categoryId, archivedAt: null },
    });
    if (limit?.amountCents) {
      const settings = await prisma.settings.findUnique({ where: { userId } });
      const month = getFinancialMonth(
        transaction.competenceDate.toISOString().slice(0, 10),
        settings?.monthStartDay ?? 1
      );
      const agg = await prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: transaction.categoryId,
          kind: { in: ["EXPENSE", "CARD_ADJUSTMENT"] },
          competenceDate: { gte: toPrismaDate(month.start), lt: toPrismaDate(month.end) },
        },
        _sum: { amountCents: true },
      });
      const utilization = calculateLimitUtilization(agg._sum.amountCents ?? 0, limit.amountCents, limit.warnAtPercent);
      limitBar = utilization;
    }
  }

  return (
    <div className="flex max-w-[520px] flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="mask-text text-title text-text">{transaction.description}</h1>
        <span className="tabular-money text-kpi-lg text-text">{formatBRL(transaction.amountCents)}</span>
      </div>

      <Card className="gap-sm">
        <MetaRow label="Categoria" value={transaction.category?.name ?? "—"} />
        <MetaRow label="Pago com" value={transaction.account?.nickname ?? transaction.card?.name ?? "—"} />
        <MetaRow label="Data" value={transaction.competenceDate.toISOString().slice(0, 10)} />
        <MetaRow label="Tipo" value={transaction.kind} />
        {transaction.installmentNo ? <MetaRow label="Parcela" value={String(transaction.installmentNo)} /> : null}
      </Card>

      {transaction.purchaseId ? (
        <Link href={`/purchases/${transaction.purchaseId}`} className="text-micro text-accent-300 hover:underline">
          Ver parcelamento completo
        </Link>
      ) : null}

      {limitBar ? (
        <Card className="gap-sm">
          <span className="text-micro text-dim">Limite da categoria</span>
          <Bar percent={limitBar.percent} severity={limitBar.percent >= 100 ? "neg" : limitBar.percent >= 80 ? "warn" : "accent"} />
          <span className="text-micro text-muted">
            {formatBRL(limitBar.spentCents)} de {formatBRL(limitBar.amountCents)}
          </span>
        </Card>
      ) : null}

      <TransactionActions id={transaction.id} />
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-row">
      <span className="text-dim">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}
