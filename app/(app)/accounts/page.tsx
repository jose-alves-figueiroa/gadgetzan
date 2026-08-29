import Link from "next/link";
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
  const [transactions, investments] = await Promise.all([
    prisma.transaction.findMany({ where: { userId } }),
    prisma.investment.findMany({ where: { userId, archivedAt: null } }),
  ]);
  const today = todayDateString();

  const balances = accounts.map((account) => ({
    account,
    balance: calculateAccountBalance(
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
    ),
  }));

  const totalAvailable = balances.filter((b) => b.account.includeInTotals).reduce((s, b) => s + b.balance, 0);
  const totalInvested = investments.reduce((s, i) => s + i.currentCents, 0);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Contas</h1>
        <CreateAccountModal />
      </div>

      <div className="grid grid-cols-3 gap-md">
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Disponível</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(totalAvailable)}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Investido</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(totalInvested)}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Reservado em porquinhos</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(0)}</span>
        </Card>
      </div>

      <div className="flex flex-col gap-md">
        {balances.map(({ account, balance }) => (
          <Link key={account.id} href={`/accounts/${account.id}`}>
            <Card className="flex-row items-center justify-between hover:bg-text/4">
              <div className="flex flex-col gap-xs">
                <span className="text-row font-medium text-text">{account.nickname}</span>
                <span className="text-micro text-dim">{account.institution}</span>
              </div>
              <span className="tabular-money text-kpi-md text-text">{formatBRL(balance)}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
