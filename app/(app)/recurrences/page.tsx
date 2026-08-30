import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { listRecurrenceRules } from "@/lib/server/recurrences";
import { listCategories } from "@/lib/server/categories";
import { listAccounts } from "@/lib/server/accounts";
import { listCards } from "@/lib/server/cards";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HighlightOnCreate } from "@/components/ui/HighlightOnCreate";
import { CreateRecurrenceModal } from "@/components/finance/CreateRecurrenceModal";
import { RecurrenceRow } from "@/components/finance/RecurrenceRow";

export default async function RecurrencesPage() {
  const [rules, categories, accounts, cards] = await Promise.all([
    listRecurrenceRules(),
    listCategories(),
    listAccounts(),
    listCards(),
  ]);

  const active = rules.filter((r) => r.status === "ACTIVE");
  const income = active.filter((r) => r.kind === "INCOME");
  const commitments = active.filter((r) => r.kind === "EXPENSE" && r.category.nature === "COMMITMENT");
  const expenses = active.filter((r) => r.kind === "EXPENSE" && r.category.nature !== "COMMITMENT");

  const sum = (list: typeof rules) => list.reduce((s, r) => s + r.amountCents, 0);
  const incomeTotal = sum(income);
  const expensesTotal = sum(expenses);
  const commitmentsTotal = sum(commitments);
  const leftover = incomeTotal - expensesTotal - commitmentsTotal;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Recorrências</h1>
        <CreateRecurrenceModal
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          accounts={accounts.map((a) => ({ id: a.id, name: a.nickname }))}
          cards={cards.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      <div className="grid grid-cols-4 gap-md">
        <Card>
          <span className="text-label uppercase text-dim">Receita fixa</span>
          <span className="tabular-money text-kpi-md text-pos">{formatBRL(incomeTotal)}</span>
        </Card>
        <Card>
          <span className="text-label uppercase text-dim">Despesa fixa</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(expensesTotal)}</span>
        </Card>
        <Card>
          <span className="text-label uppercase text-dim">Compromissos</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(commitmentsTotal)}</span>
        </Card>
        <Card>
          <span className="text-label uppercase text-dim">Sobra fixa mensal</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(leftover)}</span>
        </Card>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={ArrowsClockwise}
          title="Nenhuma recorrência cadastrada ainda"
          description="Cadastre um salário ou uma despesa fixa para que ela apareça nas projeções."
        />
      ) : (
        <div className="flex flex-col gap-xl">
          {[
            { label: "Receitas", list: rules.filter((r) => r.kind === "INCOME") },
            { label: "Compromissos", list: rules.filter((r) => r.kind === "EXPENSE" && r.category.nature === "COMMITMENT") },
            { label: "Despesas", list: rules.filter((r) => r.kind === "EXPENSE" && r.category.nature !== "COMMITMENT") },
          ].map((group) =>
            group.list.length > 0 ? (
              <div key={group.label} className="flex flex-col gap-sm">
                <span className="text-navhead uppercase text-neutral-700">{group.label}</span>
                <Card className="gap-0 divide-y divide-line p-0">
                  {group.list.map((rule) => (
                    <HighlightOnCreate key={rule.id} id={rule.id}>
                      <RecurrenceRow
                        id={rule.id}
                        description={rule.description}
                        amountCents={rule.amountCents}
                        frequency={rule.frequency}
                        dayOfMonth={rule.dayOfMonth}
                        categoryName={rule.category.name}
                        status={rule.status}
                      />
                    </HighlightOnCreate>
                  ))}
                </Card>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
