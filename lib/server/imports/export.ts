import { prisma } from "@/lib/db";

const KIND_LABELS: Record<string, string> = {
  EXPENSE: "despesa",
  INCOME: "receita",
  TRANSFER: "transferencia",
  INVESTMENT_IN: "investimento_entrada",
  INVESTMENT_OUT: "investimento_saida",
  GOAL_IN: "porquinho_entrada",
  GOAL_OUT: "porquinho_saida",
  CARD_PAYMENT: "pagamento_fatura",
  CARD_ADJUSTMENT: "ajuste_fatura",
};

const COLUMNS = [
  "id_externo",
  "tipo",
  "data",
  "descricao",
  "valor",
  "categoria",
  "metodo",
  "conta",
  "cartao",
  "conta_destino",
  "investimento",
  "porquinho",
  "parcela",
  "nota",
] as const;

type Column = (typeof COLUMNS)[number];

/** Matches the strict `\d+,\d{2}` shape the importer itself requires (lib/finance/import.ts) — no thousands separator. */
function centsToPtBr(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function csvEscape(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Reconciliation export (R15 §9) — serializes a batch's CREATED transactions
 * (not the raw uploaded files) back to CSV, names resolved, one row per
 * Transaction, so the user can diff it against the original bank statement
 * line by line. This is a denormalized single-file view for reading, not a
 * re-importable file (import itself uses separate typed files per entity).
 */
export async function exportImportBatch(userId: string, batchId: string): Promise<{ label: string; csv: string }> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, userId } });
  if (!batch) throw new Error("Lote não encontrado.");

  const transactions = await prisma.transaction.findMany({
    where: { importBatchId: batchId, userId },
    include: { category: true, account: true, toAccount: true, card: true, investment: true, goal: true },
    orderBy: [{ competenceDate: "asc" }, { createdAt: "asc" }],
  });

  const lines = [COLUMNS.join(";")];
  for (const t of transactions) {
    const row: Record<Column, string> = {
      id_externo: t.externalId ?? "",
      tipo: KIND_LABELS[t.kind] ?? t.kind,
      data: t.competenceDate.toISOString().slice(0, 10),
      descricao: t.description,
      valor: centsToPtBr(t.amountCents),
      categoria: t.category?.name ?? "",
      metodo: t.method === "ACCOUNT" ? "conta" : t.method === "CARD" ? "cartao" : "",
      conta: t.account?.nickname ?? "",
      cartao: t.card?.name ?? "",
      conta_destino: t.toAccount?.nickname ?? "",
      investimento: t.investment?.name ?? "",
      porquinho: t.goal?.name ?? "",
      parcela: t.installmentNo != null ? String(t.installmentNo) : "",
      nota: t.note ?? "",
    };
    lines.push(COLUMNS.map((c) => csvEscape(row[c])).join(";"));
  }

  return { label: batch.label, csv: lines.join("\n") };
}
