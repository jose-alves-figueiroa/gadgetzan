import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { closingForReferenceMonth } from "@/lib/finance/invoice";
import { findOrCreateInvoice } from "../invoices";
import {
  adjustInvoiceCore,
  applyInvoicePaymentCore,
  createExpenseOrIncomeCore,
  createGoalMoveCore,
  createInvestmentMoveCore,
  createRemainingInstallmentsCore,
  createTransferCore,
} from "../transaction-core";
import { validateImportCsvs } from "./validate";
import { IMPORT_COMMIT_ORDER, type ImportFilesInput, type ResolvedFatura, type ResolvedRow, type RowReport } from "./types";

export interface CommitResult {
  batchId: string;
  createdCount: number;
  skippedCount: number;
  stoppedAt?: { file: string; line: number; error: string };
}

/**
 * Phase B (R15) — re-validates (never trusts a stale client report), then
 * commits every "ok" row in the fixed cross-file order, skipping "warning"
 * (already-imported) rows. Stops at the first row that fails, keeping
 * everything already committed under the batch id — undo is the
 * compensating action for a partial commit, not a giant all-or-nothing
 * transaction (see docs/agents/02-business-rules.md R15).
 */
export async function commitImport(userId: string, files: ImportFilesInput, label: string): Promise<CommitResult> {
  const report = await validateImportCsvs(userId, files);
  if (report.accountErrors.length > 0) {
    throw new Error(report.accountErrors.join(" "));
  }
  if (report.totals.errors > 0) {
    throw new Error(`Existem ${report.totals.errors} linha(s) com erro — corrija antes de confirmar.`);
  }
  if (report.totals.ok === 0) {
    throw new Error("Nenhuma linha válida para importar.");
  }

  const batch = await prisma.importBatch.create({
    data: {
      userId,
      label,
      sourceFiles: files as Prisma.InputJsonValue,
      rowCount: report.totals.total,
      createdCount: 0,
    },
  });

  const rowsByFile = new Map<string, RowReport[]>();
  for (const row of report.rows) {
    if (row.status !== "ok" || !row.resolved) continue;
    const list = rowsByFile.get(row.file) ?? [];
    list.push(row);
    rowsByFile.set(row.file, list);
  }

  let createdCount = 0;
  const skippedCount = report.rows.filter((r) => r.status === "warning").length;
  let stoppedAt: CommitResult["stoppedAt"];

  outer: for (const file of IMPORT_COMMIT_ORDER) {
    const rows = rowsByFile.get(file) ?? [];
    const ordered = file === "faturas" ? sortAjusteBeforePagamento(rows) : rows;
    for (const row of ordered) {
      try {
        await commitRow(userId, batch.id, row.resolved!);
        createdCount++;
      } catch (err) {
        stoppedAt = { file, line: row.line, error: err instanceof Error ? err.message : String(err) };
        break outer;
      }
    }
  }

  await prisma.importBatch.update({ where: { id: batch.id }, data: { createdCount } });

  return { batchId: batch.id, createdCount, skippedCount, stoppedAt };
}

/** Within faturas.csv: ajuste rows must land before pagamento rows for the same invoice (R15 §5). */
function sortAjusteBeforePagamento(rows: RowReport[]): RowReport[] {
  const rank = (r: RowReport) => ((r.resolved as ResolvedFatura).tipo === "ajuste" ? 0 : 1);
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

async function resolveInvoiceId(userId: string, cardId: string, mesFatura: string): Promise<string> {
  const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
  if (!card) throw new Error("Cartão não encontrado.");

  const [year, month] = mesFatura.split("-").map(Number);
  closingForReferenceMonth({ year, month }, card.closingDay, card.dueDay); // validates the month math up front
  const dueDate = `${mesFatura}-${String(card.dueDay).padStart(2, "0")}`;
  const invoice = await findOrCreateInvoice(userId, card, { year, month }, dueDate);
  return invoice.id;
}

async function commitRow(userId: string, importBatchId: string, row: ResolvedRow): Promise<void> {
  switch (row.kind) {
    case "despesa":
      if (row.parcelas) {
        await createRemainingInstallmentsCore(userId, {
          description: row.descricao,
          amountCents: row.valorCents,
          competenceDate: row.data,
          categoryId: row.categoriaId,
          cardId: row.cardId!,
          currentInstallmentNo: row.parcelas.atual,
          totalInstallments: row.parcelas.total,
          note: row.nota,
          externalId: row.idExterno,
          importBatchId,
        });
      } else {
        await createExpenseOrIncomeCore(userId, {
          kind: "EXPENSE",
          description: row.descricao,
          amountCents: row.valorCents,
          competenceDate: row.data,
          categoryId: row.categoriaId,
          method: row.metodo === "conta" ? "ACCOUNT" : "CARD",
          accountId: row.accountId,
          cardId: row.cardId,
          note: row.nota,
          externalId: row.idExterno,
          importBatchId,
        });
      }
      return;

    case "receita":
      await createExpenseOrIncomeCore(userId, {
        kind: "INCOME",
        description: row.descricao,
        amountCents: row.valorCents,
        competenceDate: row.data,
        categoryId: row.categoriaId,
        method: "ACCOUNT",
        accountId: row.accountId,
        note: row.nota,
        externalId: row.idExterno,
        importBatchId,
      });
      return;

    case "transferencia":
      await createTransferCore(userId, {
        accountId: row.accountId,
        toAccountId: row.toAccountId,
        amountCents: row.valorCents,
        competenceDate: row.data,
        note: row.nota,
        externalId: row.idExterno,
        importBatchId,
      });
      return;

    case "investimento":
      await createInvestmentMoveCore(userId, {
        kind: row.direcao === "entrada" ? "INVESTMENT_IN" : "INVESTMENT_OUT",
        investmentId: row.investmentId,
        accountId: row.accountId,
        amountCents: row.valorCents,
        competenceDate: row.data,
        externalId: row.idExterno,
        importBatchId,
      });
      return;

    case "porquinho":
      await createGoalMoveCore(userId, {
        kind: row.direcao === "entrada" ? "GOAL_IN" : "GOAL_OUT",
        goalId: row.goalId,
        amountCents: row.valorCents,
        competenceDate: row.data,
        externalId: row.idExterno,
        importBatchId,
      });
      return;

    case "fatura": {
      const invoiceId = await resolveInvoiceId(userId, row.cardId, row.mesFatura);
      if (row.tipo === "pagamento") {
        await applyInvoicePaymentCore(userId, {
          invoiceId,
          accountId: row.accountId!,
          paidCents: row.valorCents,
          paidDate: row.data,
          externalId: row.idExterno,
          importBatchId,
        });
      } else {
        await adjustInvoiceCore(userId, {
          invoiceId,
          amountCents: row.valorCents,
          reason: row.descricao!,
          competenceDate: row.data,
          externalId: row.idExterno,
          importBatchId,
        });
      }
      return;
    }
  }
}
