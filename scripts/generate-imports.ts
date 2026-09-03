import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

import {
  ACCOUNT_MAP,
  CARD_MAP,
  CARD_PAYMENT_RULES,
  CATEGORY_MAP,
  DESCRIPTION_CATEGORY_MAP,
  DESCRIPTION_MAP,
  IGNORE_RULES,
  INSTALLMENT_RULES,
  INVESTMENT_MAP,
  PIGGY_BANK_MAP,
  SOURCE_COLUMNS,
  SPECIAL_RULES,
  TRANSACTION_TYPE_MAP,
  TRANSFER_RULES,
  VALID_ACCOUNTS,
  VALID_CARDS,
  VALID_CATEGORIES,
} from "./generate-import.mapper-rules";

/**
 * Gadgetzan CSV importer
 *
 * Input:
 *   data/august/nubank-conta.csv
 *   data/august/inter-conta.csv
 *   data/august/nubank-cartao.csv
 *   data/august/inter-cartao.csv
 *   data/august/xp-cartao.csv
 *
 * Output:
 *   gadgetzan_import/
 *     despesas.csv
 *     receitas.csv
 *     transferencias.csv
 *     investimentos.csv
 *     porquinhos.csv
 *     faturas.csv
 *
 * Important:
 * - Money is handled internally as integer cents.
 * - IDs are made unique across the complete import batch.
 * - Card purchases go to despesas.csv.
 * - Card payments go to faturas.csv, sourced from the bank account
 *   statement; the duplicate line in the card statement is ignored.
 * - Installment information in the transaction title takes precedence.
 * - Investments/piggy banks without a mapping in
 *   generate-import.mapper-rules.ts are never invented — they are
 *   reported as warnings instead.
 * - Ambiguous/unreconcilable transactions are reported instead of
 *   invented.
 * - All translation/mapping tables live in
 *   generate-import.mapper-rules.ts. This file only contains parsing
 *   and control flow.
 */

// ============================================================
// CONFIG
// ============================================================

const ROOT = process.cwd();

const INPUT_DIR = path.join(ROOT, "data", "august");
const OUTPUT_DIR = path.join(ROOT, "gadgetzan_import");

const INPUT_FILES = {
  nubankConta: path.join(INPUT_DIR, "nubank-conta.csv"),
  interConta: path.join(INPUT_DIR, "inter-conta.csv"),
  nubankCartao: path.join(INPUT_DIR, "nubank-cartao.csv"),
  interCartao: path.join(INPUT_DIR, "inter-cartao.csv"),
  xpCartao: path.join(INPUT_DIR, "xp-cartao.csv"),
} as const;

const FALLBACK_CATEGORY = "Outros";

const ACCOUNT_SOURCE_NAME = {
  nubankConta: "Nubank",
  interConta: "Inter",
} as const;

const CARD_SOURCE_NAME = {
  nubankCartao: "Nubank",
  interCartao: "Inter",
  xpCartao: "XP",
} as const;

const VALID_CATEGORY_SET = new Set(VALID_CATEGORIES);
const VALID_ACCOUNT_SET = new Set(VALID_ACCOUNTS);
const VALID_CARD_SET = new Set(VALID_CARDS);

// ============================================================
// TYPES
// ============================================================

type CsvRow = Record<string, string>;

type Expense = {
  id_externo: string;
  data: string;
  descricao: string;
  valor: string;
  categoria: string;
  metodo: "conta" | "cartao";
  conta: string;
  cartao: string;
  parcela_atual: string;
  total_parcelas: string;
  nota: string;
};

type Income = {
  id_externo: string;
  data: string;
  descricao: string;
  valor: string;
  categoria: string;
  conta: string;
  nota: string;
};

type Transfer = {
  id_externo: string;
  data: string;
  valor: string;
  conta_origem: string;
  conta_destino: string;
  nota: string;
};

type Investment = {
  id_externo: string;
  data: string;
  valor: string;
  investimento: string;
  conta: string;
  direcao: "aporte" | "resgate";
  nota: string;
};

type PiggyBank = {
  id_externo: string;
  data: string;
  valor: string;
  porquinho: string;
  direcao: "aporte" | "resgate";
  nota: string;
};

type Invoice = {
  id_externo: string;
  data: string;
  cartao: string;
  mes_fatura: string;
  tipo: "pagamento" | "ajuste";
  valor: string;
  conta: string;
  descricao: string;
  categoria: string;
  nota: string;
};

type Warning = {
  source: string;
  message: string;
};

type Installment = {
  current: number;
  total: number;
};

type SourceStats = {
  total: number;
  emitted: number;
  warned: number;
  reconciled: number;
};

// ============================================================
// STATE
// ============================================================

const expenses: Expense[] = [];
const incomes: Income[] = [];
const transfers: Transfer[] = [];
const investments: Investment[] = [];
const piggyBanks: PiggyBank[] = [];
const invoices: Invoice[] = [];

const warnings: Warning[] = [];

const usedIds = new Set<string>();

const stats: Record<string, SourceStats> = {};

// ============================================================
// GENERAL HELPERS
// ============================================================

function warn(source: string, message: string): void {
  warnings.push({ source, message });
  console.warn(`⚠ [${source}] ${message}`);
}

function ensureStats(source: string): SourceStats {
  stats[source] ??= { total: 0, emitted: 0, warned: 0, reconciled: 0 };
  return stats[source];
}

function trackRow(source: string): void {
  ensureStats(source).total++;
}

/**
 * Every row read must end up in exactly one bucket: emitted to an
 * output file, warned-and-skipped, or reconciled as the counterpart
 * leg of a transfer emitted from another source. There is no bare
 * `continue` in this file — assertRowConservation() below is the
 * proof that nothing fell through the cracks silently.
 */
function markEmitted(source: string): void {
  ensureStats(source).emitted++;
}

function markWarned(source: string): void {
  ensureStats(source).warned++;
}

function markReconciled(source: string): void {
  ensureStats(source).reconciled++;
}

function warnAndSkip(source: string, message: string): void {
  warn(source, message);
  markWarned(source);
}

function assertRowConservation(): void {
  for (const [source, s] of Object.entries(stats)) {
    const accounted = s.emitted + s.warned + s.reconciled;

    if (accounted !== s.total) {
      throw new Error(
        `Inconsistência interna em "${source}": ${s.total} linha(s) lida(s), ` +
          `${accounted} contabilizada(s) (emitidas=${s.emitted}, warnings=${s.warned}, reconciliadas=${s.reconciled}).`,
      );
    }
  }
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown): string {
  return normalize(value).toLowerCase();
}

function get(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    if (name in row) {
      const value = normalize(row[name]);

      if (value) {
        return value;
      }
    }
  }

  return "";
}

/**
 * Like get(), but concatenates every non-empty candidate instead of
 * returning only the first match. Used where installment/keyword
 * detection must not stop scanning just because an earlier column
 * happened to be non-empty.
 */
function getAll(row: CsvRow, ...names: string[]): string {
  return names
    .map(name => (name in row ? normalize(row[name]) : ""))
    .filter(Boolean)
    .join(" ");
}

type HeaderRequirement = {
  label: string;
  aliases: readonly string[];
};

function validateHeaders(
  filePath: string,
  rows: CsvRow[],
  requirements: HeaderRequirement[],
): void {
  if (rows.length === 0) {
    return;
  }

  const actualHeaders = Object.keys(rows[0]);

  const missing = requirements.filter(
    req => !req.aliases.some(alias => actualHeaders.includes(alias)),
  );

  if (missing.length > 0) {
    throw new Error(
      `${filePath}: coluna(s) obrigatória(s) ausente(s): ${missing
        .map(m => `${m.label} (esperado uma de: ${m.aliases.join(", ")})`)
        .join("; ")}.\n` + `Colunas encontradas no arquivo: ${actualHeaders.join(", ")}`,
    );
  }
}

/**
 * Column names that identify the real header row. Bank exports
 * sometimes prepend a title/period line (e.g. "Extrato Conta
 * Corrente") before the actual column headers — readCsv() below
 * scans for one of these to skip any such preamble automatically,
 * instead of assuming the header is always row 1.
 */
const HEADER_HINTS = new Set([
  "Data",
  "Data Lançamento",
  "Valor",
  "ID Externo",
  "ID externo",
  "Estabelecimento",
  "Descrição",
  "Descricao",
  "Descrição Banco",
  "Histórico",
  "Historico",
  "date",
  "title",
  "amount",
]);

function readCsv(filePath: string): CsvRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");

  const rawRows = parse(content, {
    columns: false,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  }) as string[][];

  const headerIndex = rawRows.findIndex(row =>
    row.some(cell => HEADER_HINTS.has(normalize(cell))),
  );

  if (headerIndex === -1) {
    throw new Error(
      `${filePath}: não foi possível localizar a linha de cabeçalho (procurando por uma coluna como ` +
        `${Array.from(HEADER_HINTS).join(", ")}). Verifique se o arquivo tem o formato esperado.`,
    );
  }

  // Some source files repeat a column name (e.g. inter-conta.csv has
  // two "Descrição" columns). Keep the first occurrence's name as-is
  // — that's the one every alias list expects — and disambiguate
  // later duplicates instead of silently overwriting the first
  // value when building the row object.
  const seen = new Map<string, number>();

  const headers = rawRows[headerIndex].map(cell => {
    const header = normalize(cell);

    if (!header) {
      return header;
    }

    const count = (seen.get(header) ?? 0) + 1;
    seen.set(header, count);

    return count === 1 ? header : `${header} (${count})`;
  });

  return rawRows.slice(headerIndex + 1).map(row => {
    const record: CsvRow = {};

    headers.forEach((header, i) => {
      if (header) {
        record[header] = row[i] ?? "";
      }
    });

    return record;
  });
}

function parseDate(value: string): string | null {
  const v = normalize(value);

  if (!v) {
    return null;
  }

  // DD/MM/YYYY
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);

  if (br) {
    const [, day, month, year] = br;

    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);

  if (iso) {
    return v;
  }

  return null;
}

/**
 * Convert money into integer cents.
 *
 * Supported:
 *   1234,56
 *   1.234,56
 *   1234.56
 *   -1234,56
 *   R$ 1.234,56
 */
function parseMoney(value: unknown): number {
  let v = normalize(value);

  if (!v) {
    throw new Error("Valor vazio");
  }

  v = v.replace(/R\$/gi, "").replace(/\s/g, "");

  // Brazilian decimal format.
  if (v.includes(",")) {
    v = v.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(v);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor inválido: ${value}`);
  }

  return Math.round(parsed * 100);
}

/**
 * Safe wrapper around parseMoney(): a single malformed cell must
 * never crash the whole import run.
 */
function tryParseMoney(value: unknown): number | null {
  try {
    return parseMoney(value);
  } catch {
    return null;
  }
}

function formatMoney(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2).replace(".", ",");
}

function sourceId(source: string, externalId: string): string {
  const id = normalize(externalId);

  if (!id) {
    throw new Error(`${source}: ID externo ausente`);
  }

  /**
   * The original external ID is preserved.
   *
   * The source prefix guarantees uniqueness between source systems
   * if two providers happen to generate the same external ID.
   */
  return `${source}:${id}`;
}

function registerId(source: string, id: string): boolean {
  if (usedIds.has(id)) {
    warnAndSkip(source, `ID duplicado ignorado: ${id}`);
    return false;
  }

  usedIds.add(id);

  return true;
}

// ============================================================
// TABLE-DRIVEN LOOKUPS (backed by mapper-rules.ts)
// ============================================================

function inferCategoryFromText(text: string): string | null {
  const lower = normalizeLower(text);

  for (const [key, category] of Object.entries(DESCRIPTION_CATEGORY_MAP)) {
    if (lower.includes(key.toLowerCase())) {
      return category;
    }
  }

  return null;
}

function mapCategory(source: string, raw: string, inferenceText: string): string {
  const v = normalize(raw);

  if (v) {
    const mapped = CATEGORY_MAP[v];

    if (mapped) {
      return mapped;
    }

    if (VALID_CATEGORY_SET.has(v)) {
      return v;
    }

    warn(source, `Categoria desconhecida "${v}", usando "${FALLBACK_CATEGORY}"`);

    return FALLBACK_CATEGORY;
  }

  const inferred = inferCategoryFromText(inferenceText);

  if (inferred) {
    return inferred;
  }

  return FALLBACK_CATEGORY;
}

function mapAccountName(raw: string): string {
  const mapped = ACCOUNT_MAP[normalize(raw)];

  if (!mapped) {
    throw new Error(`Conta desconhecida em ACCOUNT_MAP: ${raw}`);
  }

  return mapped;
}

function mapCardName(raw: string): string {
  const mapped = CARD_MAP[normalize(raw)];

  if (!mapped) {
    throw new Error(`Cartão desconhecido em CARD_MAP: ${raw}`);
  }

  return mapped;
}

function translateDescription(raw: string): string {
  const lower = normalizeLower(raw);

  for (const [key, translated] of Object.entries(DESCRIPTION_MAP)) {
    if (lower.includes(key.toLowerCase())) {
      return translated;
    }
  }

  return raw;
}

const TRANSACTION_TYPE_ENTRIES = Object.entries(TRANSACTION_TYPE_MAP).map(
  ([key, type]) => ({ key, lower: key.toLowerCase(), type }),
);

/**
 * Classifies free text against TRANSACTION_TYPE_MAP. Exact matches
 * (the whole text equals a mapped key, e.g. a "Histórico" column
 * holding just "Resgate") are tried first; substring matches (a
 * mapped key appears inside a longer free-text description) are
 * tried second. This is a SIGNAL only — callers still must apply
 * their own confirmation rules (see TRANSFER_RULES usage below)
 * before treating it as a final classification.
 */
function classifyByType(text: string): string | null {
  const lower = normalizeLower(text);

  const exact = TRANSACTION_TYPE_ENTRIES.find(entry => entry.lower === lower);

  if (exact) {
    return exact.type;
  }

  // Prefer the most specific (longest) key among substring matches —
  // insertion order alone would let a short generic key like "Resgate"
  // shadow a more specific one like "Resgate RDB".
  const partial = TRANSACTION_TYPE_ENTRIES
    .filter(entry => lower.includes(entry.lower))
    .sort((a, b) => b.lower.length - a.lower.length)[0];

  return partial ? partial.type : null;
}

function mentionsAny(text: string, keywords: readonly string[]): boolean {
  const lower = normalizeLower(text);

  return keywords.some(keyword => lower.includes(keyword.toLowerCase()));
}

function matchesIgnoredCardPayment(title: string): boolean {
  return CARD_PAYMENT_RULES.ignoredCardPaymentDescriptions.some(desc =>
    normalizeLower(title).includes(desc.toLowerCase()),
  );
}

function matchesTechnicalTransfer(cents: number, text: string): boolean {
  return IGNORE_RULES.technicalTransfers.some(
    rule => cents === rule.cents && mentionsAny(text, [rule.description]),
  );
}

// ============================================================
// INSTALLMENTS
// ============================================================

/**
 * Only the explicit "Parcela N/M" phrasing is safe to scan for
 * inside free-text titles/merchant names — a merchant literally
 * named e.g. "2 de 3 Burgers" would otherwise false-match the
 * looser "N de M" pattern from INSTALLMENT_RULES.patterns, which
 * is reserved for a column whose entire purpose is installment
 * info (see below).
 */
const TITLE_INSTALLMENT_PATTERN = /parcela\s*(\d+)\s*\/\s*(\d+)/i;

function extractInstallment(text: string, patterns: readonly RegExp[]): Installment | null {
  const value = normalize(text);

  if (!value) {
    return null;
  }

  for (const pattern of patterns) {
    const match = pattern.exec(value);

    if (!match) {
      continue;
    }

    const current = Number(match[1]);
    const total = Number(match[2]);

    if (
      Number.isInteger(current) &&
      Number.isInteger(total) &&
      current >= 1 &&
      total >= current
    ) {
      return { current, total };
    }

    return null;
  }

  return null;
}

type CardColumns = (typeof SOURCE_COLUMNS)["interCartao" | "xpCartao" | "nubankCartao"];

/**
 * Title/description wins over a dedicated installment column.
 *
 * The full title is the concatenation of every candidate column
 * (title/Estabelecimento + Descrição) — not just the first
 * non-empty one — so installment info is not missed when it lives
 * in a column other than whichever is checked first.
 *
 * Nubank provides the installment as two numeric columns instead
 * of a "Parcela" text column — those are structured truth, used
 * directly when present (still overridable by an explicit
 * "Parcela N/M" in the title, per the rule above).
 *
 * Examples:
 *   "Parcela 2/4" + column "1/4" -> 2/4
 *   "Parcela 2/3" + column "1/3" -> 2/3
 *   "Parcela 2/2" + blank        -> 2/2
 */
function getInstallment(row: CsvRow, cols: CardColumns): Installment | null {
  const fullTitle = getAll(row, ...cols.title, ...cols.description);

  const fromTitle = extractInstallment(fullTitle, [TITLE_INSTALLMENT_PATTERN]);

  if (fromTitle) {
    return fromTitle;
  }

  if ("installmentCurrent" in cols && "installmentTotal" in cols) {
    const current = Number(get(row, ...cols.installmentCurrent));
    const total = Number(get(row, ...cols.installmentTotal));

    if (Number.isInteger(current) && Number.isInteger(total) && current >= 1 && total >= current) {
      return { current, total };
    }

    return null;
  }

  if ("installmentText" in cols) {
    return extractInstallment(get(row, ...cols.installmentText), INSTALLMENT_RULES.patterns);
  }

  return null;
}

// ============================================================
// OUTPUT RECORD BUILDERS
// ============================================================

function addExpense(
  source: string,
  input: {
    id: string;
    date: string;
    description: string;
    cents: number;
    category: string;
    method: "conta" | "cartao";
    account?: string;
    card?: string;
    installment?: Installment | null;
    note?: string;
  },
): void {
  if (!registerId(source, input.id)) {
    return;
  }

  expenses.push({
    id_externo: input.id,
    data: input.date,
    descricao: input.description,
    valor: formatMoney(input.cents),
    categoria: input.category,
    metodo: input.method,
    conta: input.method === "conta" ? input.account ?? "" : "",
    cartao: input.method === "cartao" ? input.card ?? "" : "",
    parcela_atual: input.installment ? String(input.installment.current) : "",
    total_parcelas: input.installment ? String(input.installment.total) : "",
    nota: input.note ?? "",
  });

  markEmitted(source);
}

function addIncome(
  source: string,
  input: {
    id: string;
    date: string;
    description: string;
    cents: number;
    category: string;
    account: string;
    note?: string;
  },
): void {
  if (!registerId(source, input.id)) {
    return;
  }

  incomes.push({
    id_externo: input.id,
    data: input.date,
    descricao: input.description,
    valor: formatMoney(input.cents),
    categoria: input.category,
    conta: input.account,
    nota: input.note ?? "",
  });

  markEmitted(source);
}

function addTransfer(
  source: string,
  input: {
    id: string;
    date: string;
    cents: number;
    from: string;
    to: string;
    note?: string;
  },
): void {
  if (!registerId(source, input.id)) {
    return;
  }

  transfers.push({
    id_externo: input.id,
    data: input.date,
    valor: formatMoney(input.cents),
    conta_origem: input.from,
    conta_destino: input.to,
    nota: input.note ?? "",
  });

  markEmitted(source);
}

function addInvestment(
  source: string,
  input: {
    id: string;
    date: string;
    cents: number;
    investment: string;
    account: string;
    direction: "aporte" | "resgate";
    note?: string;
  },
): void {
  if (!registerId(source, input.id)) {
    return;
  }

  investments.push({
    id_externo: input.id,
    data: input.date,
    valor: formatMoney(input.cents),
    investimento: input.investment,
    conta: input.account,
    direcao: input.direction,
    nota: input.note ?? "",
  });

  markEmitted(source);
}

function addPiggyBank(
  source: string,
  input: {
    id: string;
    date: string;
    cents: number;
    piggyBank: string;
    direction: "aporte" | "resgate";
    note?: string;
  },
): void {
  if (!registerId(source, input.id)) {
    return;
  }

  piggyBanks.push({
    id_externo: input.id,
    data: input.date,
    valor: formatMoney(input.cents),
    porquinho: input.piggyBank,
    direcao: input.direction,
    nota: input.note ?? "",
  });

  markEmitted(source);
}

function addInvoice(
  source: string,
  input: {
    id: string;
    date: string;
    card: string;
    month: string;
    type: "pagamento" | "ajuste";
    cents: number;
    account?: string;
    description?: string;
    category?: string;
    note?: string;
  },
): void {
  if (!registerId(source, input.id)) {
    return;
  }

  invoices.push({
    id_externo: input.id,
    data: input.date,
    cartao: input.card,
    mes_fatura: input.month,
    tipo: input.type,
    valor: formatMoney(input.cents),
    conta: input.account ?? "",
    descricao: input.description ?? "",
    categoria: input.category ?? "",
    nota: input.note ?? "",
  });

  markEmitted(source);
}

// ============================================================
// TRANSFER RECONCILIATION (pre-pass — must run before the
// per-row account classifiers, so both legs of a self-transfer
// are consumed before either could be misread as income/expense)
// ============================================================

type TransferLeg = {
  index: number;
  date: string | null;
  cents: number | null;
  text: string;
  externalId: string;
};

const SELF_NAME_KEYWORDS = ["Jose Ricardo", "José Ricardo"];
const INTER_BANK_KEYWORDS = ["Banco Inter", "Inter"];

/**
 * Matches Inter -> Nubank self-transfers by (date, absolute value):
 * an Inter outgoing PIX addressed to the account holder's own name
 * is matched against a Nubank incoming PIX whose description names
 * Banco Inter as the source. Both legs are marked "reconciled" so
 * the main per-row classifiers skip them without re-emitting or
 * warning.
 */
function reconcileInterToNubankTransfers(
  interRows: CsvRow[],
  nubankRows: CsvRow[],
): { consumedInter: Set<number>; consumedNubank: Set<number> } {
  const consumedInter = new Set<number>();
  const consumedNubank = new Set<number>();

  const nubankCols = SOURCE_COLUMNS.nubankConta;
  const interCols = SOURCE_COLUMNS.interConta;

  const nubankIncoming: TransferLeg[] = nubankRows.map((row, index) => ({
    index,
    date: parseDate(get(row, ...nubankCols.date)),
    cents: tryParseMoney(get(row, ...nubankCols.value)),
    text: getAll(row, ...nubankCols.text),
    externalId: get(row, ...nubankCols.externalId),
  }));

  for (let i = 0; i < interRows.length; i++) {
    const row = interRows[i];

    const date = parseDate(get(row, ...interCols.date));
    const cents = tryParseMoney(get(row, ...interCols.value));
    const text = getAll(row, ...interCols.text);
    const externalId = get(row, ...interCols.externalId);

    if (!date || cents === null || cents >= 0 || !externalId) {
      continue;
    }

    if (!mentionsAny(text, SELF_NAME_KEYWORDS)) {
      continue;
    }

    const amount = Math.abs(cents);

    const match = nubankIncoming.find(
      candidate =>
        !consumedNubank.has(candidate.index) &&
        candidate.date === date &&
        candidate.cents !== null &&
        candidate.cents === amount &&
        mentionsAny(candidate.text, INTER_BANK_KEYWORDS),
    );

    if (!match) {
      continue;
    }

    consumedInter.add(i);
    consumedNubank.add(match.index);

    addTransfer("inter-conta", {
      id: sourceId("inter-conta", externalId),
      date,
      cents: amount,
      from: TRANSFER_RULES.destinations.inter,
      to: TRANSFER_RULES.destinations.nubank,
      note: "Transferência entre contas próprias",
    });

    markReconciled("nubank-conta");
  }

  return { consumedInter, consumedNubank };
}

// ============================================================
// ACCOUNT: NUBANK
// ============================================================

function parseNubankAccount(rows: CsvRow[], consumed: Set<number>): void {
  const source = "nubank-conta";
  const cols = SOURCE_COLUMNS.nubankConta;

  for (let i = 0; i < rows.length; i++) {
    trackRow(source);

    const row = rows[i];
    const lineNo = i + 2;

    if (consumed.has(i)) {
      // Already accounted for by reconcileInterToNubankTransfers()
      // (this is the silent incoming leg of an already-emitted
      // transfer) — do not mark it again here.
      continue;
    }

    const date = parseDate(get(row, ...cols.date));

    if (!date) {
      warnAndSkip(source, `Linha ${lineNo}: data inválida`);
      continue;
    }

    const rawValue = get(row, ...cols.value);

    if (!rawValue) {
      warnAndSkip(source, `Linha ${lineNo}: valor ausente`);
      continue;
    }

    const value = tryParseMoney(rawValue);

    if (value === null) {
      warnAndSkip(source, `Linha ${lineNo}: valor inválido "${rawValue}"`);
      continue;
    }

    const cents = Math.abs(value);

    const text = getAll(row, ...cols.text);
    const description = get(row, ...cols.description);
    const rawCategory = get(row, ...cols.category);

    const externalId = get(row, ...cols.externalId);

    if (!externalId) {
      warnAndSkip(source, `Linha ${lineNo}: ID externo ausente`);
      continue;
    }

    const id = sourceId(source, externalId);

    // --------------------------------------------------------
    // TECHNICAL / IGNORED MOVEMENTS
    // --------------------------------------------------------

    if (matchesTechnicalTransfer(cents, text)) {
      warnAndSkip(
        source,
        `Linha ${lineNo}: transferência técnica de ${formatMoney(cents)} ignorada`,
      );
      continue;
    }

    const type = classifyByType(text);

    // --------------------------------------------------------
    // CARD INVOICE PAYMENT
    // --------------------------------------------------------

    if (type === "card_invoice_payment") {
      if (value >= 0) {
        warnAndSkip(
          source,
          `Linha ${lineNo}: "pagamento de fatura" com valor positivo; ignorado`,
        );
        continue;
      }

      const special = SPECIAL_RULES.interNubankJulyInvoicePayment;
      const month = date === special.date && cents === special.cents
        ? special.invoiceMonth
        : date.slice(0, 7);

      addInvoice(source, {
        id,
        date,
        card: SPECIAL_RULES.nubankAccountInvoiceCard,
        month,
        type: "pagamento",
        cents,
        account: mapAccountName(ACCOUNT_SOURCE_NAME.nubankConta),
        note: "Pagamento identificado no extrato da conta",
      });

      continue;
    }

    // --------------------------------------------------------
    // PIGGY BANK (never invented — warn until PIGGY_BANK_MAP
    // has a mapping for this movement)
    // --------------------------------------------------------

    if (
      type === "piggy_bank_application" ||
      type === "piggy_bank_redemption" ||
      normalizeLower(text).includes("porquinho")
    ) {
      const piggyBankName = PIGGY_BANK_MAP[
        Object.keys(PIGGY_BANK_MAP).find(key =>
          normalizeLower(text).includes(key.toLowerCase()),
        ) ?? ""
      ];

      if (!piggyBankName) {
        warnAndSkip(
          source,
          `Linha ${lineNo}: movimento de porquinho sem mapeamento em PIGGY_BANK_MAP ("${description}"); ignorado`,
        );
        continue;
      }

      addPiggyBank(source, {
        id,
        date,
        cents,
        piggyBank: piggyBankName,
        direction: value < 0 ? "aporte" : "resgate",
        note: description,
      });

      continue;
    }

    // --------------------------------------------------------
    // INVESTMENT (never invented — warn until INVESTMENT_MAP
    // has a mapping for this movement)
    // --------------------------------------------------------

    if (type === "investment_application" || type === "investment_redemption") {
      const investmentName = INVESTMENT_MAP[
        Object.keys(INVESTMENT_MAP).find(key =>
          normalizeLower(text).includes(key.toLowerCase()),
        ) ?? ""
      ];

      if (!investmentName) {
        warnAndSkip(
          source,
          `Linha ${lineNo}: movimento de investimento sem mapeamento em INVESTMENT_MAP ("${description}"); ignorado`,
        );
        continue;
      }

      addInvestment(source, {
        id,
        date,
        cents,
        investment: investmentName,
        account: mapAccountName(ACCOUNT_SOURCE_NAME.nubankConta),
        direction: type === "investment_application" ? "aporte" : "resgate",
        note: description,
      });

      continue;
    }

    // --------------------------------------------------------
    // NUBANK -> XP MOVEMENT
    //
    // There is no XP account statement in scope, so this
    // direction cannot be reconciled against a counterpart row —
    // it is decided purely from the Nubank side, disambiguated
    // against SPECIAL_RULES.xpInvoicePayments by (date, cents).
    // --------------------------------------------------------

    if (value < 0 && mentionsAny(text, ["Banco XP"])) {
      const invoicePayment = SPECIAL_RULES.xpInvoicePayments.find(
        entry => entry.date === date && entry.cents === cents,
      );

      if (invoicePayment) {
        addInvoice(source, {
          id,
          date,
          card: invoicePayment.card,
          month: date.slice(0, 7),
          type: "pagamento",
          cents,
          account: mapAccountName(ACCOUNT_SOURCE_NAME.nubankConta),
          note: "Pagamento da fatura XP",
        });
      } else {
        addTransfer(source, {
          id,
          date,
          cents,
          from: TRANSFER_RULES.destinations.nubank,
          to: TRANSFER_RULES.destinations.xp,
          note: "Transferência para conta XP",
        });
      }

      continue;
    }

    // --------------------------------------------------------
    // UNCONFIRMED SELF-TRANSFER
    //
    // Mentions the account holder's own name but was not matched
    // by reconcileInterToNubankTransfers() — do not invent a
    // transfer or an expense/income out of it.
    // --------------------------------------------------------

    if (mentionsAny(text, SELF_NAME_KEYWORDS)) {
      warnAndSkip(
        source,
        `Linha ${lineNo}: possível transferência própria sem contraparte confirmada (${formatMoney(cents)}); ignorada`,
      );
      continue;
    }

    // --------------------------------------------------------
    // INCOME
    // --------------------------------------------------------

    if (value > 0) {
      const isSalary = type === "salary" || rawCategory === "Salário";

      addIncome(source, {
        id,
        date,
        description: description || "Receita",
        cents,
        category: isSalary ? "Salário" : "Outras receitas",
        account: mapAccountName(ACCOUNT_SOURCE_NAME.nubankConta),
      });

      continue;
    }

    // --------------------------------------------------------
    // EXPENSE
    // --------------------------------------------------------

    addExpense(source, {
      id,
      date,
      description: description || "Despesa",
      cents,
      category: mapCategory(source, rawCategory, text),
      method: "conta",
      account: mapAccountName(ACCOUNT_SOURCE_NAME.nubankConta),
    });
  }
}

// ============================================================
// ACCOUNT: INTER
// ============================================================

function parseInterAccount(rows: CsvRow[], consumed: Set<number>): void {
  const source = "inter-conta";
  const cols = SOURCE_COLUMNS.interConta;

  for (let i = 0; i < rows.length; i++) {
    trackRow(source);

    const row = rows[i];
    const lineNo = i + 2;

    if (consumed.has(i)) {
      // Already accounted for by reconcileInterToNubankTransfers()
      // (this row's own ID already produced the emitted transfer
      // record) — do not mark it again here.
      continue;
    }

    const date = parseDate(get(row, ...cols.date));

    if (!date) {
      warnAndSkip(source, `Linha ${lineNo}: data inválida`);
      continue;
    }

    const rawValue = get(row, ...cols.value);

    if (!rawValue) {
      warnAndSkip(source, `Linha ${lineNo}: valor ausente`);
      continue;
    }

    const value = tryParseMoney(rawValue);

    if (value === null) {
      warnAndSkip(source, `Linha ${lineNo}: valor inválido "${rawValue}"`);
      continue;
    }

    const cents = Math.abs(value);

    const text = getAll(row, ...cols.text);
    const description = get(row, ...cols.description);
    const history = get(row, "Histórico", "Historico");
    const rawCategory = get(row, ...cols.category);

    const externalId = get(row, ...cols.externalId);

    if (!externalId) {
      warnAndSkip(source, `Linha ${lineNo}: ID externo ausente`);
      continue;
    }

    const id = sourceId(source, externalId);

    // --------------------------------------------------------
    // TECHNICAL / IGNORED MOVEMENTS
    // --------------------------------------------------------

    if (matchesTechnicalTransfer(cents, text)) {
      warnAndSkip(
        source,
        `Linha ${lineNo}: transferência técnica de ${formatMoney(cents)} ignorada`,
      );
      continue;
    }

    const type = classifyByType(text);

    // --------------------------------------------------------
    // CARD INVOICE PAYMENT
    //
    // Unlike the Nubank account (which defaults to Cartão
    // Nubank — you're paying your own Nubank card from your own
    // Nubank account), a payment from the Inter account could be
    // for any card. We never guess which one: only an explicit
    // (date, cents) match in SPECIAL_RULES resolves it. Anything
    // else is reported, never invented.
    // --------------------------------------------------------

    if (type === "card_invoice_payment") {
      if (value >= 0) {
        warnAndSkip(
          source,
          `Linha ${lineNo}: "pagamento de fatura" com valor positivo; ignorado`,
        );
        continue;
      }

      const special = SPECIAL_RULES.interNubankJulyInvoicePayment;

      if (date === special.date && cents === special.cents) {
        addInvoice(source, {
          id,
          date,
          card: special.card,
          month: special.invoiceMonth,
          type: "pagamento",
          cents,
          account: mapAccountName(ACCOUNT_SOURCE_NAME.interConta),
          note: "Pagamento identificado no extrato Inter",
        });

        continue;
      }

      warnAndSkip(
        source,
        `Linha ${lineNo}: pagamento de fatura de ${formatMoney(cents)} sem cartão mapeado em SPECIAL_RULES; ignorado`,
      );

      continue;
    }

    // --------------------------------------------------------
    // INVESTMENT (never invented)
    // --------------------------------------------------------

    if (type === "investment_application" || type === "investment_redemption") {
      const investmentName = INVESTMENT_MAP[
        Object.keys(INVESTMENT_MAP).find(key =>
          normalizeLower(text).includes(key.toLowerCase()),
        ) ?? ""
      ];

      if (!investmentName) {
        warnAndSkip(
          source,
          `Linha ${lineNo}: movimento de investimento sem mapeamento em INVESTMENT_MAP ("${description || history}"); ignorado`,
        );
        continue;
      }

      addInvestment(source, {
        id,
        date,
        cents,
        investment: investmentName,
        account: mapAccountName(ACCOUNT_SOURCE_NAME.interConta),
        direction: type === "investment_application" ? "aporte" : "resgate",
        note: description || history,
      });

      continue;
    }

    // --------------------------------------------------------
    // TRANSFER TO NUBANK
    //
    // Handled by reconcileInterToNubankTransfers() as a pre-pass;
    // rows it matched are already in `consumed` and short-circuit
    // above. Anything reaching here mentioning the account
    // holder's own name has no confirmed counterpart.
    // --------------------------------------------------------

    if (mentionsAny(text, SELF_NAME_KEYWORDS)) {
      warnAndSkip(
        source,
        `Linha ${lineNo}: PIX para si mesmo sem contraparte confirmada (${formatMoney(cents)}); ignorado`,
      );
      continue;
    }

    // --------------------------------------------------------
    // INCOME
    // --------------------------------------------------------

    if (value > 0) {
      const isSalary = type === "salary" || rawCategory === "Salário";

      addIncome(source, {
        id,
        date,
        description: description || history || "Receita",
        cents,
        category: isSalary ? "Salário" : "Outras receitas",
        account: mapAccountName(ACCOUNT_SOURCE_NAME.interConta),
      });

      continue;
    }

    // --------------------------------------------------------
    // EXPENSE
    // --------------------------------------------------------

    addExpense(source, {
      id,
      date,
      description: description || history || "Despesa",
      cents,
      category: mapCategory(source, rawCategory, text),
      method: "conta",
      account: mapAccountName(ACCOUNT_SOURCE_NAME.interConta),
    });
  }
}

// ============================================================
// CARD PURCHASES
// ============================================================

function parseCardPurchases(rows: CsvRow[], card: string, source: string, cols: CardColumns): void {
  for (let i = 0; i < rows.length; i++) {
    trackRow(source);

    const row = rows[i];
    const lineNo = i + 2;

    const date = parseDate(get(row, ...cols.date));

    if (!date) {
      warnAndSkip(source, `Linha ${lineNo}: sem data válida; linha ignorada`);
      continue;
    }

    const establishment = get(row, ...cols.title);
    const description = get(row, ...cols.description);
    const rawValue = get(row, ...cols.value);

    if (!rawValue) {
      warnAndSkip(source, `Linha ${lineNo}: valor ausente`);
      continue;
    }

    const value = tryParseMoney(rawValue);

    if (value === null) {
      warnAndSkip(source, `Linha ${lineNo}: valor inválido "${rawValue}"`);
      continue;
    }

    const externalId = get(row, ...cols.externalId);

    if (!externalId) {
      warnAndSkip(source, `Linha ${lineNo}: ID externo ausente`);
      continue;
    }

    const id = sourceId(source, externalId);

    const title = establishment || description || "Compra";
    const fullTitleText = getAll(row, ...cols.title, ...cols.description);

    // --------------------------------------------------------
    // CARD-STATEMENT INVOICE PAYMENT DUPLICATE
    //
    // Ignore. The bank statement is the canonical payment.
    // --------------------------------------------------------

    if (matchesIgnoredCardPayment(title)) {
      warnAndSkip(
        source,
        `Linha ${lineNo}: pagamento da fatura ignorado; usar pagamento do extrato da conta`,
      );
      continue;
    }

    // --------------------------------------------------------
    // POINTS REDEMPTION / OTHER EXPLICIT INVOICE ADJUSTMENT
    // --------------------------------------------------------

    const type = classifyByType(title);

    if (type === "invoice_adjustment") {
      addInvoice(source, {
        id,
        date,
        card,
        month: date.slice(0, 7),
        type: "ajuste",
        cents: Math.abs(value),
        description: title,
        category: FALLBACK_CATEGORY,
        note: "Crédito identificado no extrato do cartão",
      });

      continue;
    }

    // --------------------------------------------------------
    // CREDIT / REFUND
    // --------------------------------------------------------

    if (value < 0) {
      addInvoice(source, {
        id,
        date,
        card,
        month: date.slice(0, 7),
        type: "ajuste",
        cents: Math.abs(value),
        description: title,
        category: mapCategory(source, get(row, ...cols.category), fullTitleText),
        note: "Estorno/crédito da fatura",
      });

      continue;
    }

    // --------------------------------------------------------
    // PURCHASE
    // --------------------------------------------------------

    const installment = getInstallment(row, cols);

    addExpense(source, {
      id,
      date,
      description: translateDescription(title),
      cents: value,
      category: mapCategory(source, get(row, ...cols.category), fullTitleText),
      method: "cartao",
      card,
      installment,
      note: description && description !== establishment ? description : "",
    });
  }
}

// ============================================================
// SORT
// ============================================================

function sortByDate<T extends { data: string; id_externo: string }>(rows: T[]): void {
  rows.sort((a, b) => {
    const dateCompare = a.data.localeCompare(b.data);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.id_externo.localeCompare(b.id_externo);
  });
}

// ============================================================
// CSV OUTPUT
// ============================================================

function writeCsv<T extends object>(filename: string, headers: string[], rows: T[]): void {
  const output = stringify(rows, {
    header: true,
    columns: headers,
    delimiter: ";",
    bom: true,
    record_delimiter: "\n",
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, filename), output, "utf8");

  console.log(`✓ ${filename.padEnd(25)} ${rows.length} linhas`);
}

// ============================================================
// VALIDATION (must run before writing any file)
// ============================================================

function validate(): number {
  console.log();
  console.log("=".repeat(70));
  console.log("VALIDAÇÃO");
  console.log("=".repeat(70));

  let errors = 0;

  // ----------------------------------------------------------
  // IDs
  // ----------------------------------------------------------

  const allRows = [
    ...expenses,
    ...incomes,
    ...transfers,
    ...investments,
    ...piggyBanks,
    ...invoices,
  ];

  const ids = new Set<string>();

  for (const row of allRows) {
    if (ids.has(row.id_externo)) {
      console.error(`✗ ID duplicado: ${row.id_externo}`);
      errors++;
    }

    ids.add(row.id_externo);
  }

  if (errors === 0) {
    console.log("✓ IDs externos únicos");
  }

  // ----------------------------------------------------------
  // DATES
  // ----------------------------------------------------------

  for (const row of allRows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.data)) {
      console.error(`✗ Data inválida: ${row.data}`);
      errors++;
    }
  }

  // ----------------------------------------------------------
  // MONEY
  // ----------------------------------------------------------

  for (const row of allRows) {
    if (!/^\d+,\d{2}$/.test(row.valor)) {
      console.error(`✗ Valor inválido: ${row.valor}`);
      errors++;
    }
  }

  // ----------------------------------------------------------
  // EXPENSES
  // ----------------------------------------------------------

  for (const row of expenses) {
    if (!VALID_CATEGORY_SET.has(row.categoria)) {
      console.error(`✗ Categoria inválida: ${row.categoria}`);
      errors++;
    }

    if (row.metodo === "conta" && (!row.conta || row.cartao)) {
      console.error(`✗ Despesa de conta inconsistente:`, row);
      errors++;
    }

    if (row.metodo === "conta" && row.conta && !VALID_ACCOUNT_SET.has(row.conta)) {
      console.error(`✗ Conta inválida em despesa: ${row.conta}`);
      errors++;
    }

    if (row.metodo === "cartao" && (!row.cartao || row.conta)) {
      console.error(`✗ Despesa de cartão inconsistente:`, row);
      errors++;
    }

    if (row.metodo === "cartao" && row.cartao && !VALID_CARD_SET.has(row.cartao)) {
      console.error(`✗ Cartão inválido em despesa: ${row.cartao}`);
      errors++;
    }

    const hasCurrent = Boolean(row.parcela_atual);
    const hasTotal = Boolean(row.total_parcelas);

    if (hasCurrent !== hasTotal) {
      console.error(`✗ Parcela incompleta:`, row);
      errors++;
    }

    if (hasCurrent && hasTotal) {
      const current = Number(row.parcela_atual);
      const total = Number(row.total_parcelas);

      if (!Number.isInteger(current) || !Number.isInteger(total) || current < 1 || total < current) {
        console.error(`✗ Parcela inválida:`, row);
        errors++;
      }
    }
  }

  // ----------------------------------------------------------
  // INCOMES
  // ----------------------------------------------------------

  for (const row of incomes) {
    if (!VALID_CATEGORY_SET.has(row.categoria)) {
      console.error(`✗ Categoria de receita inválida: ${row.categoria}`);
      errors++;
    }

    if (!row.conta) {
      console.error(`✗ Receita sem conta:`, row);
      errors++;
    } else if (!VALID_ACCOUNT_SET.has(row.conta)) {
      console.error(`✗ Conta inválida em receita: ${row.conta}`);
      errors++;
    }
  }

  // ----------------------------------------------------------
  // TRANSFERS
  // ----------------------------------------------------------

  for (const row of transfers) {
    if (!row.conta_origem || !row.conta_destino) {
      console.error(`✗ Transferência sem origem/destino:`, row);
      errors++;
    }

    if (row.conta_origem && !VALID_ACCOUNT_SET.has(row.conta_origem)) {
      console.error(`✗ Conta de origem inválida: ${row.conta_origem}`);
      errors++;
    }

    if (row.conta_destino && !VALID_ACCOUNT_SET.has(row.conta_destino)) {
      console.error(`✗ Conta de destino inválida: ${row.conta_destino}`);
      errors++;
    }
  }

  // ----------------------------------------------------------
  // INVESTMENTS
  // ----------------------------------------------------------

  for (const row of investments) {
    if (!row.conta || !VALID_ACCOUNT_SET.has(row.conta)) {
      console.error(`✗ Conta inválida em investimento: ${row.conta}`);
      errors++;
    }
  }

  // ----------------------------------------------------------
  // INVOICES
  // ----------------------------------------------------------

  for (const row of invoices) {
    if (row.tipo !== "pagamento" && row.tipo !== "ajuste") {
      console.error(`✗ Tipo de fatura inválido:`, row);
      errors++;
    }

    if (!VALID_CARD_SET.has(row.cartao)) {
      console.error(`✗ Cartão inválido em fatura: ${row.cartao}`);
      errors++;
    }

    if (row.tipo === "pagamento" && !row.conta) {
      console.error(`✗ Pagamento de fatura sem conta:`, row);
      errors++;
    }

    if (row.tipo === "pagamento" && row.conta && !VALID_ACCOUNT_SET.has(row.conta)) {
      console.error(`✗ Conta inválida em pagamento de fatura: ${row.conta}`);
      errors++;
    }

    if (row.tipo === "ajuste" && (!row.descricao || !row.categoria)) {
      console.error(`✗ Ajuste de fatura sem descrição/categoria:`, row);
      errors++;
    }

    if (row.categoria && !VALID_CATEGORY_SET.has(row.categoria)) {
      console.error(`✗ Categoria inválida em fatura: ${row.categoria}`);
      errors++;
    }
  }

  // ----------------------------------------------------------
  // RESULT
  // ----------------------------------------------------------

  if (errors === 0) {
    console.log();
    console.log("✓ IMPORTAÇÃO PASSOU NAS VALIDAÇÕES");
  } else {
    console.log();
    console.error(`✗ ${errors} erro(s) encontrado(s)`);
  }

  if (warnings.length > 0) {
    console.log();
    console.log(`⚠ ${warnings.length} warning(s)`);
  }

  return errors;
}

// ============================================================
// SUMMARY
// ============================================================

function printSummary(): void {
  const total = (rows: Array<{ valor: string }>) =>
    rows.reduce((sum, row) => sum + parseMoney(row.valor), 0);

  console.log();
  console.log("=".repeat(70));
  console.log("RESUMO");
  console.log("=".repeat(70));

  console.log(`Despesas:         ${expenses.length}`);
  console.log(`Receitas:         ${incomes.length}`);
  console.log(`Transferências:   ${transfers.length}`);
  console.log(`Investimentos:    ${investments.length}`);
  console.log(`Porquinhos:       ${piggyBanks.length}`);
  console.log(`Faturas:          ${invoices.length}`);

  console.log();

  console.log(`Total despesas:   R$ ${formatMoney(total(expenses))}`);
  console.log(`Total receitas:   R$ ${formatMoney(total(incomes))}`);
  console.log(`Transferências:   R$ ${formatMoney(total(transfers))}`);
  console.log(`Investimentos:    R$ ${formatMoney(total(investments))}`);
  console.log(`Porquinhos:       R$ ${formatMoney(total(piggyBanks))}`);
  console.log(`Faturas:          R$ ${formatMoney(total(invoices))}`);

  console.log();
  console.log("Linhas de entrada por fonte:");

  for (const [source, s] of Object.entries(stats)) {
    console.log(
      `  ${source.padEnd(16)} total=${s.total} emitidas=${s.emitted} warnings=${s.warned} reconciliadas=${s.reconciled}`,
    );
  }
}

// ============================================================
// WARNINGS
// ============================================================

function printWarnings(): void {
  if (warnings.length === 0) {
    return;
  }

  console.log();
  console.log("=".repeat(70));
  console.log("WARNINGS");
  console.log("=".repeat(70));

  for (const warning of warnings) {
    console.log(`⚠ [${warning.source}] ${warning.message}`);
  }
}

// ============================================================
// MAIN
// ============================================================

function main(): void {
  console.log("=".repeat(70));
  console.log("GADGETZAN IMPORT — AGOSTO/2026");
  console.log("=".repeat(70));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ----------------------------------------------------------
  // READ
  // ----------------------------------------------------------

  console.log();
  console.log("INPUT");

  const nubankConta = readCsv(INPUT_FILES.nubankConta);
  const interConta = readCsv(INPUT_FILES.interConta);
  const nubankCartao = readCsv(INPUT_FILES.nubankCartao);
  const interCartao = readCsv(INPUT_FILES.interCartao);
  const xpCartao = readCsv(INPUT_FILES.xpCartao);

  validateHeaders(INPUT_FILES.nubankConta, nubankConta, [
    { label: "Data", aliases: SOURCE_COLUMNS.nubankConta.date },
    { label: "Valor", aliases: SOURCE_COLUMNS.nubankConta.value },
    { label: "ID Externo", aliases: SOURCE_COLUMNS.nubankConta.externalId },
    { label: "Descrição", aliases: SOURCE_COLUMNS.nubankConta.text },
  ]);

  validateHeaders(INPUT_FILES.interConta, interConta, [
    { label: "Data", aliases: SOURCE_COLUMNS.interConta.date },
    { label: "Valor", aliases: SOURCE_COLUMNS.interConta.value },
    { label: "ID Externo", aliases: SOURCE_COLUMNS.interConta.externalId },
    { label: "Descrição/Histórico", aliases: SOURCE_COLUMNS.interConta.text },
  ]);

  validateHeaders(INPUT_FILES.nubankCartao, nubankCartao, [
    { label: "Data", aliases: SOURCE_COLUMNS.nubankCartao.date },
    { label: "Valor", aliases: SOURCE_COLUMNS.nubankCartao.value },
    { label: "ID Externo", aliases: SOURCE_COLUMNS.nubankCartao.externalId },
    { label: "Título", aliases: SOURCE_COLUMNS.nubankCartao.title },
  ]);

  for (const [file, rows, cols] of [
    [INPUT_FILES.interCartao, interCartao, SOURCE_COLUMNS.interCartao],
    [INPUT_FILES.xpCartao, xpCartao, SOURCE_COLUMNS.xpCartao],
  ] as const) {
    validateHeaders(file, rows, [
      { label: "Data", aliases: cols.date },
      { label: "Valor", aliases: cols.value },
      { label: "ID Externo", aliases: cols.externalId },
      { label: "Estabelecimento", aliases: cols.title },
    ]);
  }

  console.log(`✓ Nubank conta       ${nubankConta.length} linhas`);
  console.log(`✓ Inter conta        ${interConta.length} linhas`);
  console.log(`✓ Nubank cartão      ${nubankCartao.length} linhas`);
  console.log(`✓ Inter cartão       ${interCartao.length} linhas`);
  console.log(`✓ XP cartão          ${xpCartao.length} linhas`);

  // ----------------------------------------------------------
  // TRANSFER RECONCILIATION (must run first — see function doc)
  // ----------------------------------------------------------

  const { consumedInter, consumedNubank } = reconcileInterToNubankTransfers(
    interConta,
    nubankConta,
  );

  // ----------------------------------------------------------
  // ACCOUNT PARSING
  // ----------------------------------------------------------

  parseNubankAccount(nubankConta, consumedNubank);
  parseInterAccount(interConta, consumedInter);

  // ----------------------------------------------------------
  // CARDS
  // ----------------------------------------------------------

  parseCardPurchases(
    nubankCartao,
    mapCardName(CARD_SOURCE_NAME.nubankCartao),
    "nubank-cartao",
    SOURCE_COLUMNS.nubankCartao,
  );
  parseCardPurchases(
    interCartao,
    mapCardName(CARD_SOURCE_NAME.interCartao),
    "inter-cartao",
    SOURCE_COLUMNS.interCartao,
  );
  parseCardPurchases(xpCartao, mapCardName(CARD_SOURCE_NAME.xpCartao), "xp-cartao", SOURCE_COLUMNS.xpCartao);

  // ----------------------------------------------------------
  // ROW CONSERVATION SELF-CHECK
  //
  // Every row read from nubank-conta / inter-conta / *-cartao
  // must have ended up emitted, warned, or reconciled. This is
  // an internal invariant, not a business rule — if it throws,
  // it means a code path forgot to account for a row.
  // ----------------------------------------------------------

  assertRowConservation();

  // ----------------------------------------------------------
  // SORT
  // ----------------------------------------------------------

  sortByDate(expenses);
  sortByDate(incomes);
  sortByDate(transfers);
  sortByDate(investments);
  sortByDate(piggyBanks);
  sortByDate(invoices);

  // ----------------------------------------------------------
  // VALIDATE (before writing anything to disk)
  // ----------------------------------------------------------

  const errors = validate();

  printSummary();
  printWarnings();

  if (errors > 0) {
    console.log();
    console.error(`Importação abortada: corrija os ${errors} erro(s) acima antes de gerar os arquivos.`);
    process.exitCode = 1;
    return;
  }

  // ----------------------------------------------------------
  // WRITE
  // ----------------------------------------------------------

  console.log();
  console.log("OUTPUT");

  writeCsv(
    "despesas.csv",
    [
      "id_externo",
      "data",
      "descricao",
      "valor",
      "categoria",
      "metodo",
      "conta",
      "cartao",
      "parcela_atual",
      "total_parcelas",
      "nota",
    ],
    expenses,
  );

  writeCsv(
    "receitas.csv",
    ["id_externo", "data", "descricao", "valor", "categoria", "conta", "nota"],
    incomes,
  );

  writeCsv(
    "transferencias.csv",
    ["id_externo", "data", "valor", "conta_origem", "conta_destino", "nota"],
    transfers,
  );

  writeCsv(
    "investimentos.csv",
    ["id_externo", "data", "valor", "investimento", "conta", "direcao", "nota"],
    investments,
  );

  writeCsv(
    "porquinhos.csv",
    ["id_externo", "data", "valor", "porquinho", "direcao", "nota"],
    piggyBanks,
  );

  writeCsv(
    "faturas.csv",
    [
      "id_externo",
      "data",
      "cartao",
      "mes_fatura",
      "tipo",
      "valor",
      "conta",
      "descricao",
      "categoria",
      "nota",
    ],
    invoices,
  );

  console.log();
  console.log(`Arquivos: ${OUTPUT_DIR}`);
}

main();
