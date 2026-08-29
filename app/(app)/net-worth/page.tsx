import Link from "next/link";
import { getNetWorthHistory, type NetWorthRange } from "@/lib/server/networth";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const RANGES: NetWorthRange[] = ["6M", "12M", "ALL"];

export default async function NetWorthPage({ searchParams }: PageProps<"/net-worth">) {
  const search = await searchParams;
  const range: NetWorthRange = RANGES.includes(search?.range as NetWorthRange) ? (search!.range as NetWorthRange) : "6M";

  const { points, changeCents } = await getNetWorthHistory(range);
  const current = points.find((p) => p.isCurrent) ?? points[0];
  const maxAbs = Math.max(...points.map((p) => Math.abs(p.netWorthCents)), 1);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Patrimônio líquido</h1>
        <div className="inline-flex rounded-md border border-line bg-surface p-xs text-micro">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/net-worth?range=${r}`}
              className={cn("rounded-sm px-lg py-sm", r === range ? "text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-muted")}
            >
              {r === "ALL" ? "Tudo" : r}
            </Link>
          ))}
        </div>
      </div>

      <Card className="gap-sm">
        <span className="tabular-money text-kpi-lg text-text">{formatBRL(current.netWorthCents, { compact: true })}</span>
        <span className={cn("text-micro", changeCents >= 0 ? "text-pos" : "text-neg")}>
          {changeCents >= 0 ? "+" : ""}
          {formatBRL(changeCents, { compact: true })} no período
        </span>
      </Card>

      <div className="grid grid-cols-2 gap-md">
        <Card className="gap-xs">
          <span className="text-micro text-dim">Disponível</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(current.accountsCents, { compact: true })}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-micro text-dim">Investido</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(current.investedCents, { compact: true })}</span>
        </Card>
      </div>

      <Card className="gap-md">
        <span className="text-navhead uppercase text-neutral-700">Evolução mensal</span>
        <div className="flex gap-xs overflow-x-auto">
          {points.map((p) => {
            const heightPercent = Math.max(4, (Math.abs(p.netWorthCents) / maxAbs) * 100);
            return (
              <div key={`${p.year}-${p.month}`} className="flex min-w-[36px] flex-1 flex-col items-center gap-xs">
                <div className="flex h-40 w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-sm",
                      p.isProjection ? "border border-accent bg-transparent" : p.isCurrent ? "bg-accent" : "bg-accent-800"
                    )}
                    style={{ height: `${heightPercent}%` }}
                    title={formatBRL(p.netWorthCents)}
                  />
                </div>
                <span className="text-center text-micro text-dim">{p.label.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-micro text-dim">
        {changeCents >= 0
          ? `Patrimônio cresceu ${formatBRL(changeCents, { compact: true })} no período selecionado.`
          : `Patrimônio caiu ${formatBRL(-changeCents, { compact: true })} no período selecionado.`}
      </p>
    </div>
  );
}
