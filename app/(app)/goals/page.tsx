import Link from "next/link";
import { PiggyBank } from "@phosphor-icons/react/dist/ssr";
import { listGoalsWithProgress } from "@/lib/server/goals";
import { listAccounts } from "@/lib/server/accounts";
import { listInvestments } from "@/lib/server/investments";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { EmptyState } from "@/components/ui/EmptyState";
import { HighlightOnCreate } from "@/components/ui/HighlightOnCreate";
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
        <EmptyState
          icon={PiggyBank}
          title="Nenhum porquinho ainda"
          description="Crie uma meta para reservar dinheiro com um prazo e acompanhar o ritmo."
          action={
            <CreateGoalModal
              accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname }))}
              investments={investments.map((i) => ({ id: i.id, name: i.name }))}
              triggerLabel="+ Criar porquinho"
            />
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Link key={goal.id} href={`/goals/${goal.id}`}>
              <HighlightOnCreate id={goal.id}>
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
                      {goal.pace.status === "on_pace" ? (
                        "No ritmo"
                      ) : (
                        <>
                          <span className="tabular-money">{formatBRL(goal.pace.behindByCents, { compact: true })}</span>{" "}
                          abaixo do ritmo
                        </>
                      )}
                    </span>
                  ) : null}
                  <span className="text-micro text-dim">
                    Faltam{" "}
                    <span className="tabular-money">
                      {formatBRL(Math.max(0, goal.targetCents - goal.savedCents), { compact: true })}
                    </span>
                  </span>
                </Card>
              </HighlightOnCreate>
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
