import Link from "next/link";
import { listGoalsWithProgress } from "@/lib/server/goals";
import { listAccounts } from "@/lib/server/accounts";
import { listInvestments } from "@/lib/server/investments";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { CreateGoalModal } from "@/components/finance/CreateGoalModal";

export default async function GoalsPage() {
  const [{ goals, availableCents, reservedCents, freeToSpendCents }, accounts, investments] = await Promise.all([
    listGoalsWithProgress(),
    listAccounts(),
    listInvestments(),
  ]);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Porquinhos</h1>
        <CreateGoalModal
          accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname }))}
          investments={investments.map((i) => ({ id: i.id, name: i.name }))}
        />
      </div>

      <Card className="gap-sm">
        <div className="flex items-center justify-between text-row">
          <span className="text-dim">Saldo disponível</span>
          <span className="tabular-money text-text">{formatBRL(availableCents)}</span>
        </div>
        <div className="flex items-center justify-between text-row">
          <span className="text-dim">Reservado em porquinhos</span>
          <span className="tabular-money text-text">−{formatBRL(reservedCents)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-sm text-row">
          <span className="text-text">Livre para gastar</span>
          <span className="tabular-money text-text">{formatBRL(freeToSpendCents)}</span>
        </div>
        <Bar percent={availableCents === 0 ? 0 : (reservedCents / availableCents) * 100} />
      </Card>

      {goals.length === 0 ? (
        <p className="text-micro text-dim">Nenhum porquinho ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-md lg:grid-cols-3">
          {goals.map((goal) => (
            <Link key={goal.id} href={`/goals/${goal.id}`}>
              <Card className="gap-sm">
                <div className="flex items-center justify-between">
                  <span className="text-title">{goal.icon}</span>
                  {goal.targetDate ? <span className="text-micro text-dim">{goal.targetDate}</span> : null}
                </div>
                <span className="text-row text-text">{goal.name}</span>
                <span className="tabular-money text-micro text-muted">
                  {formatBRL(goal.savedCents, { compact: true })} de {formatBRL(goal.targetCents, { compact: true })}
                </span>
                <Bar percent={(goal.savedCents / goal.targetCents) * 100} />
                {goal.pace ? (
                  <span className={`text-micro ${goal.pace.status === "on_pace" ? "text-pos" : "text-warn"}`}>
                    {goal.pace.status === "on_pace"
                      ? "No ritmo"
                      : `${formatBRL(goal.pace.behindByCents, { compact: true })} abaixo do ritmo`}
                  </span>
                ) : null}
                <span className="text-micro text-dim">
                  Faltam {formatBRL(Math.max(0, goal.targetCents - goal.savedCents), { compact: true })}
                </span>
              </Card>
            </Link>
          ))}
          <CreateGoalModal
            accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname }))}
            investments={investments.map((i) => ({ id: i.id, name: i.name }))}
            triggerLabel="+ Criar porquinho"
          />
        </div>
      )}
    </div>
  );
}
