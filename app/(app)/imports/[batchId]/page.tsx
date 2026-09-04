import { notFound } from "next/navigation";
import { getImportBatch } from "@/lib/server/imports/queries";
import { requireUserId } from "@/lib/server/session";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ImportBatchActions } from "@/components/finance/ImportBatchActions";

const KIND_LABEL: Record<string, string> = {
  EXPENSE: "Despesa",
  INCOME: "Receita",
  TRANSFER: "Transferência",
  INVESTMENT_IN: "Aporte",
  INVESTMENT_OUT: "Resgate",
  GOAL_IN: "Porquinho (entrada)",
  GOAL_OUT: "Porquinho (saída)",
  CARD_PAYMENT: "Pagamento de fatura",
  CARD_ADJUSTMENT: "Ajuste de fatura",
};

export default async function ImportBatchDetailPage({ params }: PageProps<"/imports/[batchId]">) {
  const { batchId } = await params;
  const userId = await requireUserId();
  const batch = await getImportBatch(userId, batchId);
  if (!batch) notFound();

  const undone = batch.status === "UNDONE";

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title text-text">{batch.label}</h1>
          <span className="text-micro text-dim">{batch.createdAt.toISOString().slice(0, 10)}</span>
        </div>
        <ImportBatchActions batchId={batch.id} undone={undone} />
      </div>

      <div className="grid grid-cols-2 gap-md md:grid-cols-3">
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Status</span>
          <Tag variant={undone ? "neutral" : "confirmado"}>{undone ? "Desfeito" : "Confirmado"}</Tag>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Linhas no arquivo</span>
          <span className="tabular-money text-kpi-md text-text">{batch.rowCount}</span>
        </Card>
        <Card className="gap-xs">
          <span className="text-label uppercase text-dim">Lançamentos criados</span>
          <span className="tabular-money text-kpi-md text-text">{batch.transactions.length}</span>
        </Card>
      </div>

      {batch.transactions.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell>Tipo</TableHeaderCell>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell className="text-right">Valor</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {batch.transactions.map((t) => (
              <TableRow key={t.id} edgeFade={false}>
                <TableCell className="text-muted">{t.competenceDate.toISOString().slice(0, 10)}</TableCell>
                <TableCell className="text-muted">{KIND_LABEL[t.kind] ?? t.kind}</TableCell>
                <TableCell className="text-text"><span className="mask-text">{t.description}</span></TableCell>
                <TableCell className="tabular-money text-right text-text">{formatBRL(t.amountCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-micro text-dim">Nenhum lançamento — o lote foi desfeito ou não criou nada.</p>
      )}
    </div>
  );
}
