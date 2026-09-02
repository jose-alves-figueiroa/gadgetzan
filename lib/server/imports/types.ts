import type { ImportFileKind, ParcelasInfo } from "@/lib/finance/import";

export type ImportFilesInput = Partial<Record<ImportFileKind, string>>;

export interface ResolvedDespesa {
  kind: "despesa";
  idExterno: string;
  data: string;
  descricao: string;
  valorCents: number;
  categoriaId: string;
  metodo: "conta" | "cartao";
  accountId: string | null;
  cardId: string | null;
  parcelas: ParcelasInfo | null;
  nota: string | null;
}

export interface ResolvedReceita {
  kind: "receita";
  idExterno: string;
  data: string;
  descricao: string;
  valorCents: number;
  categoriaId: string;
  accountId: string;
  nota: string | null;
}

export interface ResolvedTransferencia {
  kind: "transferencia";
  idExterno: string;
  data: string;
  valorCents: number;
  accountId: string;
  toAccountId: string;
  nota: string | null;
}

export interface ResolvedInvestimento {
  kind: "investimento";
  idExterno: string;
  data: string;
  valorCents: number;
  investmentId: string;
  accountId: string;
  direcao: "entrada" | "saida";
}

export interface ResolvedPorquinho {
  kind: "porquinho";
  idExterno: string;
  data: string;
  valorCents: number;
  goalId: string;
  direcao: "entrada" | "saida";
}

export interface ResolvedFatura {
  kind: "fatura";
  idExterno: string;
  data: string;
  cardId: string;
  mesFatura: string;
  tipo: "pagamento" | "ajuste";
  valorCents: number;
  accountId: string | null;
  descricao: string | null;
  categoriaId: string | null;
  nota: string | null;
}

export type ResolvedRow =
  | ResolvedDespesa
  | ResolvedReceita
  | ResolvedTransferencia
  | ResolvedInvestimento
  | ResolvedPorquinho
  | ResolvedFatura;

export type RowStatus = "ok" | "warning" | "error";

export interface RowReport {
  file: ImportFileKind;
  line: number;
  summary: string;
  status: RowStatus;
  messages: string[];
  /** Present when status is "ok" or "warning" — a "warning" row is skipped at commit time. */
  resolved?: ResolvedRow;
}

export interface ImportValidationReport {
  rows: RowReport[];
  totals: { total: number; ok: number; warnings: number; errors: number };
  /** Batch-level errors that aren't tied to one row, e.g. "N linhas antes da abertura da conta X". */
  accountErrors: string[];
}

/** Every externalId a row will occupy once committed (installment rows expand to `${id}#1`, `${id}#2`, ...). */
export function externalIdsFor(row: ResolvedRow): string[] {
  if (row.kind === "despesa" && row.parcelas) {
    const { atual, total } = row.parcelas;
    const count = total - atual + 1;
    return Array.from({ length: count }, (_, i) => `${row.idExterno}#${atual + i}`);
  }
  return [row.idExterno];
}

/** Fixed cross-file commit order (§5 of the import runbook) — expenses/adjustments must land before invoice payments. */
export const IMPORT_COMMIT_ORDER: ImportFileKind[] = [
  "despesas",
  "receitas",
  "transferencias",
  "investimentos",
  "porquinhos",
  "faturas",
];
