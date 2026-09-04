import Link from "next/link";
import { getMonthData } from "@/lib/server/month";
import { calculateLimitUtilization, calculateTotalMonthSpend } from "@/lib/finance/limits";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { Donut } from "@/components/ui/Donut";
import type { FinanceTransaction } from "@/lib/finance/types";

const ACCENT_RAMP = ["#968ae0", "#796cbf", "#5d5294", "#423a6a", "#3f424d"];

export default async function MonthPage({ searchParams }: PageProps<"/month">) {
  const search = await searchParams;
  const offset = Number(search?.offset ?? 0);
  const { month, current, previous, expensesByCategory, limits, categories } = await getMonthData(offset);

  const totalExpenses = current.expenses;
  const donutSlices = expensesByCategory
    .slice(0, 5)
    .map((c, i) => ({ value: c.amountCents, color: ACCENT_RAMP[i] ?? "#3f424d" }));

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title capitalize text-text">{month.label}</h1>
        <div className="flex gap-md text-row">
          <Link href={`/month?offset=${offset - 1}`} className="text-dim hover:text-text">
            ‹ Anterior
          </Link>
          <Link href={`/month?offset=${offset + 1}`} className="text-dim hover:text-text">
            Próximo ›
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-md md:grid-cols-3">
        <KpiCard label="Receitas" value={current.income} previous={previous.income} />
        <KpiCard label="Despesas" value={current.expenses} previous={previous.expenses} invert />
        <KpiCard label="Sobra em caixa" value={current.cashLeftover} previous={previous.cashLeftover} />
      </div>

      <Card className="flex-row items-center gap-2xl">
        <Donut slices={donutSlices} centerLabel={formatBRL(totalExpenses, { compact: true })} />
        <div className="flex flex-col gap-sm">
          {expensesByCategory.slice(0, 5).map((c, i) => (
            <div key={c.name} className="flex items-center gap-sm text-row">
              <span className="h-2 w-2 rounded-full" style={{ background: ACCENT_RAMP[i] ?? "#3f424d" }} />
              <span className="text-text">{c.name}</span>
              <span className="tabular-money text-dim">{formatBRL(c.amountCents)}</span>
            </div>
          ))}
        </div>
      </Card>

      {limits.length > 0 ? (
        <div className="flex flex-col gap-sm">
          <span className="text-navhead uppercase text-neutral-700">Limites do mês</span>
          {limits.map((limit) => {
            let spent = 0;
            let label = "Total do mês";
            if (limit.scope === "CATEGORY" && limit.categoryId) {
              spent = expensesByCategory.find((c) => c.name === categories.find((cat) => cat.id === limit.categoryId)?.name)?.amountCents ?? 0;
              label = categories.find((cat) => cat.id === limit.categoryId)?.name ?? "Categoria";
            } else if (limit.scope === "TOTAL_MONTH") {
              spent = calculateTotalMonthSpend(
                expensesByCategory.map(
                  (c): FinanceTransaction => ({
                    id: c.name,
                    kind: "EXPENSE",
                    amountCents: c.amountCents,
                    competenceDate: month.start,
                    categoryId: c.name,
                  })
                ),
                categories.map((c) => ({ id: c.name, nature: c.nature })),
                limit.includeCommitments
              );
            } else {
              return null;
            }
            const utilization = calculateLimitUtilization(spent, limit.amountCents ?? 0, limit.warnAtPercent);
            return (
              <Card key={limit.id} className="gap-sm">
                <div className="flex items-center justify-between text-row">
                  <span className="text-text">{label}</span>
                  <span className="tabular-money text-dim">
                    {formatBRL(utilization.spentCents)} de {formatBRL(utilization.amountCents)}
                  </span>
                </div>
                <Bar
                  percent={utilization.percent}
                  severity={utilization.status === "exceeded" ? "neg" : utilization.status === "warning" ? "warn" : "accent"}
                />
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card className="gap-sm">
        <span className="text-micro text-dim">Taxa de poupança</span>
        <span className="tabular-nums-mono text-kpi-md text-text">
          {current.savingsRate === null ? "—" : `${(current.savingsRate * 100).toFixed(1)}%`}
        </span>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  previous,
  invert = false,
}: {
  label: string;
  value: number;
  previous: number;
  invert?: boolean;
}) {
  const delta = value - previous;
  const good = invert ? delta <= 0 : delta >= 0;
  return (
    <Card className="gap-xs">
      <span className="text-label uppercase text-dim">{label}</span>
      <span className="tabular-money text-kpi-md text-text">{formatBRL(value)}</span>
      {previous !== 0 ? (
        <span className={`text-micro ${good ? "text-pos" : "text-neg"}`}>
          <span className="tabular-money">
            {delta >= 0 ? "+" : ""}
            {formatBRL(delta)}
          </span>{" "}
          vs. mês anterior
        </span>
      ) : null}
    </Card>
  );
}
