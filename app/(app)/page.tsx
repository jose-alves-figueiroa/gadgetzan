import { redirect } from "next/navigation";
import { listAccounts } from "@/lib/server/accounts";
import { getDashboardData } from "@/lib/server/dashboard";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";

export default async function DashboardPage() {
  const accounts = await listAccounts();
  if (accounts.length === 0) redirect("/onboarding");

  const data = await getDashboardData();

  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-3 gap-md">
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Patrimônio líquido</span>
          <span className="tabular-money text-kpi-lg text-text">{formatBRL(data.netWorth, { compact: true })}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Saldo disponível</span>
          <span className="tabular-money text-kpi-lg text-text">{formatBRL(data.availableBalance, { compact: true })}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Cartões</span>
          {data.cards.length > 0 ? (
            <div className="flex flex-col gap-xs">
              {data.cards.slice(0, 2).map(({ card, availableCents, utilizationPercent }) => (
                <div key={card.id} className="flex flex-col gap-xs">
                  <span className="text-micro text-muted">
                    {card.name}: {formatBRL(availableCents, { compact: true })} disponível
                  </span>
                  <Bar percent={utilizationPercent} severity={utilizationPercent >= 80 ? "warn" : "accent"} />
                </div>
              ))}
            </div>
          ) : (
            <span className="text-row text-dim">Sem cartões</span>
          )}
        </Card>
      </div>

      <Card className="gap-md">
        <span className="text-navhead uppercase capitalize text-neutral-700">{data.monthLabel} — realizado</span>
        <div className="grid grid-cols-5 gap-md">
          <RealizedStat label="Receitas" value={data.monthSavings.income} color="text-pos" />
          <RealizedStat label="Despesas" value={data.monthSavings.expenses} color="text-text" />
          <RealizedStat label="Aportes" value={data.monthSavings.contributions} color="text-text" />
          <RealizedStat label="Sobra em caixa" value={data.monthSavings.cashLeftover} color="text-text" />
          <div className="flex flex-col gap-xs">
            <span className="text-micro text-dim">Taxa de poupança</span>
            <span className="tabular-money text-kpi-md text-text">
              {data.monthSavings.savingsRate === null ? "—" : `${(data.monthSavings.savingsRate * 100).toFixed(1)}%`}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[1fr_352px] gap-md">
        <Card className="gap-sm">
          <span className="text-navhead uppercase text-neutral-700">Próximo mês previsto</span>
          <p className="text-row text-dim">Projeção completa chega no Stage 5.</p>
        </Card>

        <div className="flex flex-col gap-md">
          <Card className="gap-sm">
            <span className="text-navhead uppercase text-neutral-700">Alertas</span>
            {data.alerts.length > 0 ? (
              data.alerts.slice(0, 3).map((alert) => (
                <div key={alert.alertKey} className="flex flex-col gap-xs rounded-md bg-tile p-sm">
                  <span className="text-micro text-text">{alert.title}</span>
                </div>
              ))
            ) : (
              <p className="text-micro text-dim">Nenhum alerta no momento.</p>
            )}
          </Card>

          <Card className="gap-sm">
            <span className="text-navhead uppercase text-neutral-700">Porquinhos</span>
            <p className="text-micro text-dim">Chega no Stage 6.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RealizedStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-micro text-dim">{label}</span>
      <span className={`tabular-money text-kpi-md ${color}`}>{formatBRL(value)}</span>
    </div>
  );
}
