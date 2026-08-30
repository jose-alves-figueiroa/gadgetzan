import { getUpcomingMonths } from "@/lib/server/future";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { LowConfidence } from "@/components/ui/LowConfidence";
import { cn } from "@/lib/cn";

const CONFIDENCE_COLOR: Record<"CONFIRMED" | "RECURRING" | "PROJECTED", string> = {
  CONFIRMED: "bg-accent",
  RECURRING: "bg-accent-800",
  PROJECTED: "bg-tile",
};

export default async function FuturePage() {
  const { months } = await getUpcomingMonths();

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="text-title text-text">Próximos meses</h1>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m, index) => (
          <Card
            key={`${m.year}-${m.month}`}
            className={cn(
              "gap-sm",
              index === 0 && "shadow-[inset_0_0_0_1px_var(--color-accent)]",
              index >= 4 && "opacity-[.72]"
            )}
          >
            <span className="capitalize text-row text-text">{m.label}</span>
            <div className="flex flex-col gap-xs text-micro">
              <Line label="Receitas" value={m.incomeCents} color="text-pos" />
              <Line label="Despesas" value={-m.expensesCents} color="text-text" />
              <Line label="Faturas" value={-m.invoicesCents} color="text-text" />
              <Line label="Resultado" value={m.resultCents} color={m.resultCents >= 0 ? "text-pos" : "text-neg"} />
            </div>
            <div className="flex items-center justify-between border-t border-line pt-xs text-micro">
              <span className="text-dim">Saldo projetado</span>
              <span className="tabular-money text-text">{formatBRL(m.projectedBalanceCents, { compact: true })}</span>
            </div>
            {index >= 4 ? <p className="text-micro text-dim">Confiança menor — mais distante no tempo.</p> : null}
            {m.lowConfidence ? <LowConfidence /> : null}
          </Card>
        ))}
      </div>

      <Card className="gap-md">
        <span className="text-navhead uppercase text-neutral-700">Composição do gasto comprometido</span>
        <div className="flex flex-col gap-sm">
          {months.map((m) => {
            const total = m.breakdown.CONFIRMED + m.breakdown.RECURRING + m.breakdown.PROJECTED;
            return (
              <div key={`${m.year}-${m.month}`} className="flex items-center gap-md">
                <span className="w-28 shrink-0 truncate text-micro capitalize text-dim">{m.label}</span>
                <div className="flex h-[8px] flex-1 overflow-hidden rounded-sm bg-tile">
                  {(["CONFIRMED", "RECURRING", "PROJECTED"] as const).map((confidence) =>
                    total > 0 ? (
                      <div
                        key={confidence}
                        className={CONFIDENCE_COLOR[confidence]}
                        style={{ width: `${(m.breakdown[confidence] / total) * 100}%` }}
                      />
                    ) : null
                  )}
                </div>
                <span className="w-24 shrink-0 text-right tabular-money text-micro text-muted">
                  {formatBRL(total, { compact: true })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-lg text-micro text-dim">
          <Legend color="bg-accent" label="Confirmado" />
          <Legend color="bg-accent-800" label="Recorrente" />
          <Legend color="bg-tile" label="Projetado" />
        </div>
      </Card>
    </div>
  );
}

function Line({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dim">{label}</span>
      <span className={`tabular-money ${color}`}>{formatBRL(value, { compact: true })}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-xs">
      <span className={`h-[8px] w-[8px] rounded-sm ${color}`} />
      {label}
    </div>
  );
}
