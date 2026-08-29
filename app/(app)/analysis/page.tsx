import Link from "next/link";
import { getAnalysisData, type AnalysisDimension } from "@/lib/server/analysis";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { cn } from "@/lib/cn";

const DIMENSIONS: { value: AnalysisDimension; label: string }[] = [
  { value: "category", label: "Categoria" },
  { value: "card", label: "Cartão" },
  { value: "account", label: "Conta" },
];

const NATURE_LABEL: Record<string, string> = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
  COMMITMENT: "Compromisso",
};

export default async function AnalysisPage({ searchParams }: PageProps<"/analysis">) {
  const search = await searchParams;
  const dimension: AnalysisDimension = (["category", "card", "account"] as const).includes(
    search?.dim as AnalysisDimension
  )
    ? (search!.dim as AnalysisDimension)
    : "category";

  const data = await getAnalysisData(dimension);
  const maxValue = Math.max(...data.rows.map((r) => r.valueCents), 1);
  const natureTotal = data.natureBreakdown.FIXED + data.natureBreakdown.VARIABLE + data.natureBreakdown.COMMITMENT;
  const maxBar = Math.max(...data.monthlyBars.map((b) => b.valueCents), 1);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Análise</h1>
        <div className="inline-flex rounded-md border border-line bg-surface p-xs text-micro">
          {DIMENSIONS.map((d) => (
            <Link
              key={d.value}
              href={`/analysis?dim=${d.value}`}
              className={cn("rounded-sm px-lg py-sm", d.value === dimension ? "text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted")}
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>
      <span className="capitalize text-micro text-dim">{data.month.label}</span>

      <div className="grid grid-cols-[1fr_320px] gap-md">
        <div className="flex flex-col gap-sm">
          {data.rows.length === 0 ? (
            <p className="text-micro text-dim">Nenhuma despesa neste mês.</p>
          ) : (
            data.rows.map((row) => (
              <Card key={row.id} className="gap-xs">
                <div className="flex items-center justify-between text-row">
                  <span className="text-text">{row.name}</span>
                  <span className="tabular-money text-text">{formatBRL(row.valueCents)}</span>
                </div>
                <Bar percent={(row.valueCents / maxValue) * 100} />
                <div className="flex items-center justify-between text-micro text-dim">
                  <span>
                    {row.nature ? `${NATURE_LABEL[row.nature] ?? row.nature} · ` : ""}
                    {row.percentOfTotal.toFixed(1)}% do total
                    {row.limitCents ? ` · limite ${formatBRL(row.limitCents, { compact: true })}` : ""}
                  </span>
                  {row.changePercent !== null ? (
                    <span className={row.changePercent > 0 ? "text-neg" : "text-pos"}>
                      {row.changePercent > 0 ? "+" : ""}
                      {row.changePercent.toFixed(0)}% vs. mês anterior
                    </span>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="flex flex-col gap-md">
          <Card className="gap-sm">
            <span className="text-navhead uppercase text-neutral-700">Natureza do gasto</span>
            {(["FIXED", "COMMITMENT", "VARIABLE"] as const).map((nature) => (
              <div key={nature} className="flex items-center justify-between text-micro">
                <span className="text-dim">{NATURE_LABEL[nature]}</span>
                <span className="tabular-money text-text">
                  {formatBRL(data.natureBreakdown[nature], { compact: true })}
                  {natureTotal > 0 ? ` (${Math.round((data.natureBreakdown[nature] / natureTotal) * 100)}%)` : ""}
                </span>
              </div>
            ))}
            <p className="text-micro text-dim">Só o gasto variável é ajustável no curto prazo.</p>
          </Card>

          <Card className="gap-sm">
            <span className="text-navhead uppercase text-neutral-700">Despesas mensais</span>
            <div className="flex gap-xs">
              {data.monthlyBars.map((b) => (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-xs">
                  <div className="flex h-20 w-full items-end">
                    <div className="w-full rounded-sm bg-accent-800" style={{ height: `${Math.max(4, (b.valueCents / maxBar) * 100)}%` }} title={formatBRL(b.valueCents)} />
                  </div>
                  <span className="text-micro text-dim">{b.label.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </Card>

          {data.topVariance ? (
            <p className="text-micro text-dim">
              Maior variação: <span className="text-text">{data.topVariance.name}</span>{" "}
              {(data.topVariance.changePercent ?? 0) > 0 ? "subiu" : "caiu"}{" "}
              {Math.abs(data.topVariance.changePercent ?? 0).toFixed(0)}% vs. o mês anterior.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
