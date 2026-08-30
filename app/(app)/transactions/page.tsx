import Link from "next/link";
import { ListDashes } from "@phosphor-icons/react/dist/ssr";
import { listTransactions } from "@/lib/server/transactions";
import { formatBRL } from "@/lib/finance/money";
import { isExpense, isIncome } from "@/lib/finance/transactions";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function TransactionsPage() {
  const transactions = await listTransactions();

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col gap-lg">
        <h1 className="text-title text-text">Lançamentos</h1>
        <EmptyState
          icon={ListDashes}
          title="Nenhum lançamento ainda"
          description="Use o botão “+ Novo lançamento”, no topo da tela, para registrar o primeiro."
        />
      </div>
    );
  }

  const byDay = new Map<string, typeof transactions>();
  for (const t of transactions) {
    const day = t.competenceDate.toISOString().slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), t]);
  }

  const periodInflows = transactions.filter((t) => isIncome(t.kind)).reduce((s, t) => s + t.amountCents, 0);
  const periodOutflows = transactions.filter((t) => isExpense(t.kind)).reduce((s, t) => s + t.amountCents, 0);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Lançamentos</h1>
        <div className="flex gap-lg text-row">
          <span className="text-pos tabular-money">+{formatBRL(periodInflows)}</span>
          <span className="text-neg tabular-money">-{formatBRL(periodOutflows)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-lg">
        {[...byDay.entries()].map(([day, dayTransactions]) => {
          const dayTotal = dayTransactions.reduce(
            (s, t) => s + (isIncome(t.kind) ? t.amountCents : isExpense(t.kind) ? -t.amountCents : 0),
            0
          );

          return (
            <div key={day} className="flex flex-col gap-sm">
              <div className="flex items-center justify-between text-micro text-dim">
                <span>{day}</span>
                <span className="tabular-money">{formatBRL(dayTotal)}</span>
              </div>
              <Card className="gap-0 divide-y divide-line p-0">
                {dayTransactions.map((t) => (
                  <Link
                    key={t.id}
                    href={`/transactions/${t.id}`}
                    className="flex items-center justify-between px-md py-sm hover:bg-text/4"
                  >
                    <div className="flex flex-col gap-xs">
                      <span className="text-row text-text">{t.description}</span>
                      <span className="text-micro text-dim">
                        {t.category?.name ?? "—"} · {t.account?.nickname ?? t.card?.name ?? "—"}
                      </span>
                    </div>
                    <span
                      className={`tabular-money text-row ${
                        isIncome(t.kind) ? "text-pos" : isExpense(t.kind) ? "text-text" : "text-dim"
                      }`}
                    >
                      {isIncome(t.kind) ? "+" : isExpense(t.kind) ? "−" : ""}
                      {formatBRL(t.amountCents)}
                    </span>
                  </Link>
                ))}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
