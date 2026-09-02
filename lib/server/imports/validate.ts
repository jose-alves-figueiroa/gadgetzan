import { prisma } from "@/lib/db";
import { parseCsv } from "@/lib/finance/csv";
import {
  IMPORT_FILE_KINDS,
  validateDespesaRow,
  validateFaturaRow,
  validateInvestimentoRow,
  validatePorquinhoRow,
  validateReceitaRow,
  validateTransferenciaRow,
  type ImportFileKind,
  type RowResult,
} from "@/lib/finance/import";
import { loadNameMaps, type NameMaps } from "./resolve";
import { externalIdsFor, type ImportFilesInput, type ImportValidationReport, type ResolvedRow, type RowReport } from "./types";
import { formatBRL } from "@/lib/finance/money";

function lookupOrFail(map: Map<string, string>, name: string, label: string, messages: string[]): string | null {
  const id = map.get(name);
  if (!id) messages.push(`${label} "${name}" não encontrada — cadastre-a antes de importar ou corrija o nome.`);
  return id ?? null;
}

function reportFromRowResult<T>(
  file: ImportFileKind,
  line: number,
  result: RowResult<T>,
  summary: (row: T) => string
): { messages: string[]; row: T | null; summary: string } {
  if (!result.ok) {
    return { messages: result.errors.map((e) => `${e.field}: ${e.message}`), row: null, summary: `${file} (linha ${line})` };
  }
  return { messages: [], row: result.row, summary: summary(result.row) };
}

function resolveRow(file: ImportFileKind, line: number, raw: Record<string, string>, maps: NameMaps): RowReport {
  switch (file) {
    case "despesas": {
      const { messages, row, summary } = reportFromRowResult(file, line, validateDespesaRow(raw), (r) => `${r.descricao} — ${formatBRL(r.valorCents)}`);
      if (!row) return { file, line, summary, status: "error", messages };

      const categoriaId = lookupOrFail(maps.categories, row.categoria, "Categoria", messages);
      const accountId = row.metodo === "conta" ? lookupOrFail(maps.accounts, row.conta!, "Conta", messages) : null;
      const cardId = row.metodo === "cartao" ? lookupOrFail(maps.cards, row.cartao!, "Cartão", messages) : null;
      if (messages.length > 0) return { file, line, summary, status: "error", messages };

      const resolved: ResolvedRow = {
        kind: "despesa",
        idExterno: row.idExterno,
        data: row.data,
        descricao: row.descricao,
        valorCents: row.valorCents,
        categoriaId: categoriaId!,
        metodo: row.metodo,
        accountId,
        cardId,
        parcelas: row.parcelas,
        nota: row.nota,
      };
      return { file, line, summary, status: "ok", messages, resolved };
    }

    case "receitas": {
      const { messages, row, summary } = reportFromRowResult(file, line, validateReceitaRow(raw), (r) => `${r.descricao} — ${formatBRL(r.valorCents)}`);
      if (!row) return { file, line, summary, status: "error", messages };

      const categoriaId = lookupOrFail(maps.categories, row.categoria, "Categoria", messages);
      const accountId = lookupOrFail(maps.accounts, row.conta, "Conta", messages);
      if (messages.length > 0) return { file, line, summary, status: "error", messages };

      const resolved: ResolvedRow = {
        kind: "receita",
        idExterno: row.idExterno,
        data: row.data,
        descricao: row.descricao,
        valorCents: row.valorCents,
        categoriaId: categoriaId!,
        accountId: accountId!,
        nota: row.nota,
      };
      return { file, line, summary, status: "ok", messages, resolved };
    }

    case "transferencias": {
      const { messages, row, summary } = reportFromRowResult(file, line, validateTransferenciaRow(raw), (r) => `${r.contaOrigem} → ${r.contaDestino} — ${formatBRL(r.valorCents)}`);
      if (!row) return { file, line, summary, status: "error", messages };

      const accountId = lookupOrFail(maps.accounts, row.contaOrigem, "Conta de origem", messages);
      const toAccountId = lookupOrFail(maps.accounts, row.contaDestino, "Conta de destino", messages);
      if (messages.length > 0) return { file, line, summary, status: "error", messages };

      const resolved: ResolvedRow = {
        kind: "transferencia",
        idExterno: row.idExterno,
        data: row.data,
        valorCents: row.valorCents,
        accountId: accountId!,
        toAccountId: toAccountId!,
        nota: row.nota,
      };
      return { file, line, summary, status: "ok", messages, resolved };
    }

    case "investimentos": {
      const { messages, row, summary } = reportFromRowResult(file, line, validateInvestimentoRow(raw), (r) => `${r.investimento} (${r.direcao}) — ${formatBRL(r.valorCents)}`);
      if (!row) return { file, line, summary, status: "error", messages };

      const investmentId = lookupOrFail(maps.investments, row.investimento, "Investimento", messages);
      const accountId = lookupOrFail(maps.accounts, row.conta, "Conta", messages);
      if (messages.length > 0) return { file, line, summary, status: "error", messages };

      const resolved: ResolvedRow = {
        kind: "investimento",
        idExterno: row.idExterno,
        data: row.data,
        valorCents: row.valorCents,
        investmentId: investmentId!,
        accountId: accountId!,
        direcao: row.direcao,
      };
      return { file, line, summary, status: "ok", messages, resolved };
    }

    case "porquinhos": {
      const { messages, row, summary } = reportFromRowResult(file, line, validatePorquinhoRow(raw), (r) => `${r.porquinho} (${r.direcao}) — ${formatBRL(r.valorCents)}`);
      if (!row) return { file, line, summary, status: "error", messages };

      const goalId = lookupOrFail(maps.goals, row.porquinho, "Porquinho", messages);
      if (messages.length > 0) return { file, line, summary, status: "error", messages };

      const resolved: ResolvedRow = {
        kind: "porquinho",
        idExterno: row.idExterno,
        data: row.data,
        valorCents: row.valorCents,
        goalId: goalId!,
        direcao: row.direcao,
      };
      return { file, line, summary, status: "ok", messages, resolved };
    }

    case "faturas": {
      const { messages, row, summary } = reportFromRowResult(file, line, validateFaturaRow(raw), (r) => `${r.tipo} ${r.cartao} ${r.mesFatura} — ${formatBRL(r.valorCents)}`);
      if (!row) return { file, line, summary, status: "error", messages };

      const cardId = lookupOrFail(maps.cards, row.cartao, "Cartão", messages);
      const accountId = row.tipo === "pagamento" ? lookupOrFail(maps.accounts, row.conta!, "Conta", messages) : null;
      const categoriaId = row.tipo === "ajuste" ? lookupOrFail(maps.categories, row.categoria!, "Categoria", messages) : null;
      if (messages.length > 0) return { file, line, summary, status: "error", messages };

      const resolved: ResolvedRow = {
        kind: "fatura",
        idExterno: row.idExterno,
        data: row.data,
        cardId: cardId!,
        mesFatura: row.mesFatura,
        tipo: row.tipo,
        valorCents: row.valorCents,
        accountId,
        descricao: row.descricao,
        categoriaId,
        nota: row.nota,
      };
      return { file, line, summary, status: "ok", messages, resolved };
    }
  }
}

/**
 * Phase A (R15) — parses and validates every uploaded file, resolving names
 * to ids and flagging externalId collisions, entirely read-only. Nothing
 * touches the database except SELECTs.
 */
export async function validateImportCsvs(userId: string, files: ImportFilesInput): Promise<ImportValidationReport> {
  const maps = await loadNameMaps(userId);
  const rows: RowReport[] = [];

  for (const file of IMPORT_FILE_KINDS) {
    const text = files[file];
    if (!text) continue;
    const { rows: csvRows } = parseCsv(text);
    for (const csvRow of csvRows) {
      rows.push(resolveRow(file, csvRow.line, csvRow.values, maps));
    }
  }

  await flagExternalIdCollisions(rows);
  const accountErrors = checkAccountWindows(rows, maps);

  const totals = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    warnings: rows.filter((r) => r.status === "warning").length,
    errors: rows.filter((r) => r.status === "error").length,
  };

  return { rows, totals, accountErrors };
}

async function flagExternalIdCollisions(rows: RowReport[]): Promise<void> {
  const candidates = rows.filter((r) => r.status === "ok" && r.resolved).flatMap((r) => externalIdsFor(r.resolved!));
  if (candidates.length === 0) return;

  const existing = await prisma.transaction.findMany({
    where: { externalId: { in: candidates } },
    select: { externalId: true },
  });
  if (existing.length === 0) return;
  const existingSet = new Set(existing.map((e) => e.externalId));

  for (const row of rows) {
    if (row.status !== "ok" || !row.resolved) continue;
    if (externalIdsFor(row.resolved).some((id) => existingSet.has(id))) {
      row.status = "warning";
      row.messages.push("id_externo já importado anteriormente — esta linha será pulada na confirmação.");
    }
  }
}

/**
 * R15/R12: instead of one error per backdated row, one aggregated error per
 * account whose earliest referenced date predates its openingDate — the
 * concrete guard against silently corrupting balance/net-worth history.
 */
function checkAccountWindows(rows: RowReport[], maps: NameMaps): string[] {
  const earliestByAccount = new Map<string, string>();
  const countByAccount = new Map<string, number>();

  const track = (accountId: string | null | undefined, date: string) => {
    if (!accountId) return;
    const opening = maps.accountOpeningDate.get(accountId);
    if (!opening || date >= opening) return;
    const current = earliestByAccount.get(accountId);
    if (!current || date < current) earliestByAccount.set(accountId, date);
    countByAccount.set(accountId, (countByAccount.get(accountId) ?? 0) + 1);
  };

  for (const row of rows) {
    if (row.status === "error" || !row.resolved) continue;
    const r = row.resolved;
    if (r.kind === "receita" || r.kind === "investimento") track(r.accountId, r.data);
    else if (r.kind === "transferencia") {
      track(r.accountId, r.data);
      track(r.toAccountId, r.data);
    } else if (r.kind === "despesa" && r.metodo === "conta") track(r.accountId, r.data);
    else if (r.kind === "fatura" && r.tipo === "pagamento") track(r.accountId, r.data);
  }

  const accountNameById = new Map([...maps.accounts.entries()].map(([name, id]) => [id, name]));
  return [...earliestByAccount.entries()].map(([accountId, earliest]) => {
    const name = accountNameById.get(accountId) ?? accountId;
    const opening = maps.accountOpeningDate.get(accountId);
    const count = countByAccount.get(accountId) ?? 0;
    return `${count} linha(s) anteriores à abertura de "${name}" (${opening}) — ajuste a data/saldo de abertura da conta antes de importar.`;
  });
}
