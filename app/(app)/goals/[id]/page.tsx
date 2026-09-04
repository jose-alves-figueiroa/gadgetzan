import { notFound } from "next/navigation";
import { getGoal } from "@/lib/server/goals";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ClickableTableRow } from "@/components/ui/ClickableTableRow";
import { GoalMoveModal } from "@/components/finance/GoalMoveModal";

export default async function GoalDetailPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  const result = await getGoal(id);
  if (!result) notFound();
  const { goal, savedCents, pace } = result;

  const percent = (savedCents / goal.targetCents) * 100;

  return (
    <div className="flex max-w-[520px] flex-col gap-lg">
      <div className="flex items-center gap-md">
        <span className="text-title">{goal.icon}</span>
        <h1 className="text-title text-text">{goal.name}</h1>
      </div>

      <Card className="gap-sm">
        <span className="tabular-money text-kpi-lg text-text">{formatBRL(savedCents, { compact: true })}</span>
        <span className="text-micro text-dim">
          de <span className="tabular-money">{formatBRL(goal.targetCents, { compact: true })}</span>
        </span>
        <Bar percent={percent} />
        <span className="text-micro text-muted">{Math.round(percent)}% guardado</span>
      </Card>

      {pace ? (
        <Card className={`gap-xs ${pace.status === "behind_pace" ? "shadow-[inset_0_0_0_1px_var(--color-warn)]" : ""}`}>
          <span className="text-row text-text">{pace.status === "on_pace" ? "No ritmo" : "Abaixo do ritmo"}</span>
          <span className="text-micro text-muted">
            Ritmo necessário: <span className="tabular-money">{formatBRL(pace.requiredPaceCents, { compact: true })}</span>/mês
            {pace.status === "behind_pace" ? (
              <>
                {" "}
                — faltam <span className="tabular-money">{formatBRL(pace.behindByCents, { compact: true })}</span>/mês
              </>
            ) : null}
          </span>
        </Card>
      ) : (
        <p className="text-micro text-dim">Sem prazo definido — acompanhando apenas o progresso.</p>
      )}

      <Card className="gap-sm">
        <MetaRow label="Prazo" value={goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : "Sem prazo"} />
        <MetaRow label="Aporte mensal alvo" value={goal.monthlyTargetCents ? formatBRL(goal.monthlyTargetCents) : "—"} />
        <MetaRow label="Onde fica guardado" value={goal.account?.nickname ?? goal.investment?.name ?? "—"} />
      </Card>

      <div className="flex gap-md">
        <GoalMoveModal goalId={goal.id} kind="save" />
        <GoalMoveModal goalId={goal.id} kind="withdraw" />
      </div>

      {goal.transactions.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell className="text-right">Valor</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {goal.transactions.map((t) => (
              <ClickableTableRow key={t.id} href={`/transactions/${t.id}`}>
                <TableCell className="text-muted">{t.competenceDate.toISOString().slice(0, 10)}</TableCell>
                <TableCell className="text-text">{t.description}</TableCell>
                <TableCell className={`tabular-money text-right ${t.kind === "GOAL_IN" ? "text-pos" : "text-text"}`}>
                  {t.kind === "GOAL_IN" ? "+" : "−"}
                  {formatBRL(t.amountCents)}
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-micro text-dim">Nenhuma movimentação ainda.</p>
      )}
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
