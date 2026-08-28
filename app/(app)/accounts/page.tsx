import { listAccounts } from "@/lib/server/accounts";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/server/session";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import { todayDateString } from "@/lib/server/clock";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { CreateAccountModal } from "@/components/finance/CreateAccountModal";
import { UnderConstruction } from "@/components/layout/UnderConstruction";

export default async function AccountsPage() {
  const accounts = await listAccounts();

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col gap-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-title text-text">Contas</h1>
          <CreateAccountModal />
        </div>
        <UnderConstruction title="Nenhuma conta cadastrada ainda" />
      </div>
    );
  }

  const userId = await requireUserId();
  const transactions = await prisma.transaction.findMany({ where: { userId } });
  const today = todayDateString();

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Contas</h1>
        <CreateAccountModal />
      </div>

      <div className="flex flex-col gap-md">
        {accounts.map((account) => {
          const balance = calculateAccountBalance(
            account.id,
            account.openingBalance,
            transactions.map((t) => ({
              id: t.id,
              kind: t.kind,
              amountCents: t.amountCents,
              competenceDate: t.competenceDate.toISOString().slice(0, 10),
              accountId: t.accountId,
              toAccountId: t.toAccountId,
              method: t.method,
            })),
            today
          );

          return (
            <Card key={account.id} className="flex-row items-center justify-between">
              <div className="flex flex-col gap-xs">
                <span className="text-row font-medium text-text">{account.nickname}</span>
                <span className="text-micro text-dim">{account.institution}</span>
              </div>
              <span className="tabular-money text-kpi-md text-text">{formatBRL(balance)}</span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
