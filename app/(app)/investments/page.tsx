import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { listInvestments } from "@/lib/server/investments";
import { listAccounts } from "@/lib/server/accounts";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateInvestmentModal } from "@/components/finance/CreateInvestmentModal";

export default async function InvestmentsPage() {
  const [investments, accounts] = await Promise.all([listInvestments(), listAccounts()]);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Investimentos</h1>
        <CreateInvestmentModal accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname }))} />
      </div>

      {investments.length === 0 ? (
        <EmptyState
          icon={ChartLineUp}
          title="Nenhum investimento cadastrado ainda"
          description="Registre um investimento para acompanhar valor aplicado e atual."
        />
      ) : (
        <div className="flex flex-col gap-md">
          {investments.map((investment) => (
            <Card key={investment.id} className="flex-row items-center justify-between">
              <span className="text-row font-medium text-text">{investment.name}</span>
              <span className="tabular-money text-kpi-md text-text">{formatBRL(investment.currentCents)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
