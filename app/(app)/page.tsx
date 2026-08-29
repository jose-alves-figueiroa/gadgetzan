import Link from "next/link";
import { redirect } from "next/navigation";
import { listAccounts } from "@/lib/server/accounts";
import { getDashboardData } from "@/lib/server/dashboard";
import { getUpcomingMonths } from "@/lib/server/future";
import { getCalendarMonth } from "@/lib/server/calendar";
import { listGoalsWithProgress } from "@/lib/server/goals";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";

export default async function DashboardPage() {
  const accounts = await listAccounts();
  if (accounts.length === 0) redirect("/onboarding");

  const [data, { months }, calendar, goals] = await Promise.all([
    getDashboardData(),
    getUpcomingMonths(),
    getCalendarMonth(0),
    listGoalsWithProgress(),
  ]);
  const nextMonth = months[0];
  const upcomingEvents = calendar.agenda.filter((r) => r.date >= calendar.month.start).slice(0, 4);

  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-3 gap-md">
        <Card className="gap-xs">
          <Link href="/net-worth" className="text-label uppercase text-dim hover:text-text">
            Patrimônio líquido
          </Link>
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
        <div className="flex flex-col gap-md">
          <Card className="gap-sm">
            <Link href="/future" className="text-navhead uppercase text-neutral-700 hover:text-text">
              Próximo mês previsto — {nextMonth.label}
            </Link>
            <div className="grid grid-cols-4 gap-md text-micro">
              <ForecastStat label="Receitas" value={nextMonth.incomeCents} color="text-pos" />
              <ForecastStat label="Despesas" value={-nextMonth.expensesCents} color="text-text" />
              <ForecastStat label="Faturas" value={-nextMonth.invoicesCents} color="text-text" />
              <ForecastStat
                label="Resultado"
                value={nextMonth.resultCents}
                color={nextMonth.resultCents >= 0 ? "text-pos" : "text-neg"}
              />
            </div>
            {nextMonth.lowConfidence ? (
              <p className="text-micro text-dim">Sem histórico suficiente ainda para projetar despesas variáveis.</p>
            ) : null}
            <div className="flex items-center justify-between border-t border-line pt-sm text-row">
              <span className="text-dim">Saldo projetado</span>
              <span className="tabular-money text-text">{formatBRL(nextMonth.projectedBalanceCents, { compact: true })}</span>
            </div>
          </Card>

          <Card className="gap-sm">
            <span className="text-navhead uppercase text-neutral-700">Faturas projetadas</span>
            <div className="flex gap-md">
              {months.slice(0, 5).map((m) => {
                const max = Math.max(...months.slice(0, 5).map((x) => x.invoicesCents), 1);
                const heightPercent = m.invoicesCents > 0 ? Math.max(6, (m.invoicesCents / max) * 100) : 2;
                return (
                  <div key={`${m.year}-${m.month}`} className="flex flex-1 flex-col items-center gap-xs">
                    <div className="flex h-20 w-full items-end">
                      <div
                        className="w-full rounded-sm border border-accent bg-accent/20"
                        style={{ height: `${heightPercent}%` }}
                        title={formatBRL(m.invoicesCents)}
                      />
                    </div>
                    <span className="text-micro text-dim">{m.label.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-md">
          <Card className="gap-sm">
            <Link href="/alerts" className="text-navhead uppercase text-neutral-700 hover:text-text">
              Alertas
            </Link>
            {data.alerts.length > 0 ? (
              data.alerts.map((alert) => (
                <div key={alert.alertKey} className="flex flex-col gap-xs rounded-md bg-tile p-sm">
                  <span className="text-micro text-text">{alert.title}</span>
                </div>
              ))
            ) : (
              <p className="text-micro text-dim">Nenhum alerta no momento.</p>
            )}
          </Card>

          <Card className="gap-sm">
            <Link href="/goals" className="text-navhead uppercase text-neutral-700 hover:text-text">
              Porquinhos
            </Link>
            {goals.goals.length > 0 ? (
              goals.goals.slice(0, 3).map((goal) => (
                <div key={goal.id} className="flex flex-col gap-xs">
                  <div className="flex items-center justify-between text-micro">
                    <span className="text-text">{goal.name}</span>
                    <span className="text-dim">
                      {formatBRL(goal.savedCents, { compact: true })} / {formatBRL(goal.targetCents, { compact: true })}
                    </span>
                  </div>
                  <Bar percent={(goal.savedCents / goal.targetCents) * 100} />
                </div>
              ))
            ) : (
              <p className="text-micro text-dim">Nenhum porquinho ainda.</p>
            )}
          </Card>

          <Card className="gap-sm">
            <Link href="/calendar" className="text-navhead uppercase text-neutral-700 hover:text-text">
              Próximos eventos
            </Link>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((row, index) => (
                <div key={index} className="flex items-center justify-between text-micro">
                  <span className="text-text">{row.label}</span>
                  <span className="text-dim">{row.date.slice(8, 10)}/{row.date.slice(5, 7)}</span>
                </div>
              ))
            ) : (
              <p className="text-micro text-dim">Nenhum evento próximo.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ForecastStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-dim">{label}</span>
      <span className={`tabular-money ${color}`}>{formatBRL(value, { compact: true })}</span>
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
