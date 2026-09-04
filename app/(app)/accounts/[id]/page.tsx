import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/server/session";
import { accountTransactionDirection, calculateAccountBalance, calculateAccountFlows } from "@/lib/finance/accounts";
import { todayDateString } from "@/lib/server/clock";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ClickableTableRow } from "@/components/ui/ClickableTableRow";
import { AccountActions } from "@/components/finance/AccountActions";
import { EditAccountBalanceModal } from "@/components/finance/EditAccountBalanceModal";

export default async function AccountDetailPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();

  const account = await prisma.account.findFirst({ where: { id, userId } });
  if (!account) notFound();

  const transactions = await prisma.transaction.findMany({
    where: { userId, OR: [{ accountId: id }, { toAccountId: id }] },
    orderBy: { competenceDate: "desc" },
    include: { category: true },
  });

  const today = todayDateString();
  const financeTx = transactions.map((t) => ({
    id: t.id,
    kind: t.kind,
    amountCents: t.amountCents,
    competenceDate: t.competenceDate.toISOString().slice(0, 10),
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    method: t.method,
  }));
  const balance = calculateAccountBalance(id, account.openingBalance, financeTx, today);
  const { inflowsCents: inflows, outflowsCents: outflows } = calculateAccountFlows(id, financeTx, today);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title text-text">{account.nickname}</h1>
          <span className="text-micro text-dim">{account.institution}</span>
        </div>
        <div className="flex items-center gap-md">
          <span className="tabular-money text-kpi-lg text-text">{formatBRL(balance)}</span>
          <EditAccountBalanceModal
            accountId={account.id}
            openingBalanceCents={account.openingBalance}
            openingDate={account.openingDate.toISOString().slice(0, 10)}
          />
          <AccountActions id={account.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-md md:grid-cols-3">
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Entradas</span>
          <span className="tabular-money text-kpi-md text-pos">{formatBRL(inflows)}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Saídas</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(outflows)}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Saldo atual</span>
          <span className="tabular-money text-kpi-md text-text">{formatBRL(balance)}</span>
        </Card>
      </div>

      {transactions.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell className="text-right">Valor</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.slice(0, 20).map((t) => {
              const direction = accountTransactionDirection(id, {
                id: t.id,
                kind: t.kind,
                amountCents: t.amountCents,
                competenceDate: t.competenceDate.toISOString().slice(0, 10),
                accountId: t.accountId,
                toAccountId: t.toAccountId,
                method: t.method,
              });
              return (
                <ClickableTableRow key={t.id} href={`/transactions/${t.id}`}>
                  <TableCell className="text-muted">{t.competenceDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-text">{t.description}</TableCell>
                  <TableCell
                    className={`tabular-money text-right ${
                      direction === "in" ? "text-pos" : direction === "out" ? "text-neg" : "text-text"
                    }`}
                  >
                    {direction === "in" ? "+" : direction === "out" ? "−" : ""}
                    {formatBRL(t.amountCents)}
                  </TableCell>
                </ClickableTableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-micro text-dim">Nenhum lançamento ainda.</p>
      )}
    </div>
  );
}
