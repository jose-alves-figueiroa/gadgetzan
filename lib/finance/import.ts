// R15 — batch CSV import: pure row-shape validation (regex/required-ness/
// cross-field checks). Name → id resolution (categoria/conta/cartão/...)
// needs the database and lives in lib/server/imports/resolve.ts.
import { toCents } from "./money";

export type ImportFileKind = "despesas" | "receitas" | "transferencias" | "investimentos" | "porquinhos" | "faturas";

export const IMPORT_FILE_KINDS: ImportFileKind[] = [
  "despesas",
  "receitas",
  "transferencias",
  "investimentos",
  "porquinhos",
  "faturas",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALOR_RE = /^\d+,\d{2}$/;

export interface RowError {
  field: string;
  message: string;
}

export type RowResult<T> = { ok: true; row: T } | { ok: false; errors: RowError[] };

/** Accumulates field errors for one row; nothing throws until `.result()`. */
class RowBuilder {
  private errors: RowError[] = [];

  fail(field: string, message: string): void {
    this.errors.push({ field, message });
  }

  require(field: string, value: string): string | null {
    if (!value) {
      this.fail(field, `${field} é obrigatório.`);
      return null;
    }
    return value;
  }

  date(field: string, value: string): string | null {
    const v = this.require(field, value);
    if (v === null) return null;
    if (!DATE_RE.test(v)) {
      this.fail(field, `${field} deve estar no formato AAAA-MM-DD (recebido "${v}").`);
      return null;
    }
    return v;
  }

  amountCents(field: string, value: string): number | null {
    const v = this.require(field, value);
    if (v === null) return null;
    if (!VALOR_RE.test(v)) {
      this.fail(field, `${field} deve estar no formato 123,45 — vírgula decimal, exatamente 2 casas (recebido "${v}").`);
      return null;
    }
    return toCents(v);
  }

  enumField<T extends string>(field: string, value: string, allowed: readonly T[]): T | null {
    const v = this.require(field, value);
    if (v === null) return null;
    if (!(allowed as readonly string[]).includes(v)) {
      this.fail(field, `${field} deve ser um de: ${allowed.join(", ")} (recebido "${v}").`);
      return null;
    }
    return v as T;
  }

  optional(value: string): string | null {
    return value.trim() === "" ? null : value.trim();
  }

  positiveInt(field: string, value: string): number | null {
    if (!/^\d+$/.test(value)) {
      this.fail(field, `${field} deve ser um número inteiro positivo (recebido "${value}").`);
      return null;
    }
    const n = Number(value);
    if (n < 1) {
      this.fail(field, `${field} deve ser >= 1.`);
      return null;
    }
    return n;
  }

  result<T>(row: T): RowResult<T> {
    return this.errors.length > 0 ? { ok: false, errors: this.errors } : { ok: true, row };
  }
}

export interface ParcelasInfo {
  atual: number;
  total: number;
}

export interface DespesaRow {
  idExterno: string;
  data: string;
  descricao: string;
  valorCents: number;
  categoria: string;
  metodo: "conta" | "cartao";
  conta: string | null;
  cartao: string | null;
  parcelas: ParcelasInfo | null;
  nota: string | null;
}

export function validateDespesaRow(raw: Record<string, string>): RowResult<DespesaRow> {
  const b = new RowBuilder();
  const idExterno = b.require("id_externo", raw.id_externo ?? "");
  const data = b.date("data", raw.data ?? "");
  const descricao = b.require("descricao", raw.descricao ?? "");
  const valorCents = b.amountCents("valor", raw.valor ?? "");
  const categoria = b.require("categoria", raw.categoria ?? "");
  const metodo = b.enumField("metodo", raw.metodo ?? "", ["conta", "cartao"] as const);
  const conta = b.optional(raw.conta ?? "");
  const cartao = b.optional(raw.cartao ?? "");
  const nota = b.optional(raw.nota ?? "");

  if (metodo === "conta" && !conta) b.fail("conta", "conta é obrigatória quando metodo=conta.");
  if (metodo === "cartao" && !cartao) b.fail("cartao", "cartao é obrigatório quando metodo=cartao.");

  const parcelas = parseParcelas(b, raw.parcela_atual ?? "", raw.total_parcelas ?? "");
  if (parcelas && metodo !== "cartao") {
    b.fail("parcela_atual", "parcela_atual/total_parcelas só se aplicam a metodo=cartao.");
  }

  return b.result({
    idExterno: idExterno ?? "",
    data: data ?? "",
    descricao: descricao ?? "",
    valorCents: valorCents ?? 0,
    categoria: categoria ?? "",
    metodo: (metodo ?? "conta") as "conta" | "cartao",
    conta,
    cartao,
    parcelas,
    nota,
  });
}

function parseParcelas(b: RowBuilder, rawAtual: string, rawTotal: string): ParcelasInfo | null {
  const hasAtual = rawAtual.trim() !== "";
  const hasTotal = rawTotal.trim() !== "";
  if (!hasAtual && !hasTotal) return null;
  if (hasAtual !== hasTotal) {
    b.fail("parcela_atual", "parcela_atual e total_parcelas devem ser preenchidos juntos.");
    return null;
  }

  const atual = b.positiveInt("parcela_atual", rawAtual.trim());
  const total = b.positiveInt("total_parcelas", rawTotal.trim());
  if (atual === null || total === null) return null;
  if (atual > total) {
    b.fail("parcela_atual", `parcela_atual (${atual}) não pode ser maior que total_parcelas (${total}).`);
    return null;
  }
  return { atual, total };
}

export interface ReceitaRow {
  idExterno: string;
  data: string;
  descricao: string;
  valorCents: number;
  categoria: string;
  conta: string;
  nota: string | null;
}

export function validateReceitaRow(raw: Record<string, string>): RowResult<ReceitaRow> {
  const b = new RowBuilder();
  const idExterno = b.require("id_externo", raw.id_externo ?? "");
  const data = b.date("data", raw.data ?? "");
  const descricao = b.require("descricao", raw.descricao ?? "");
  const valorCents = b.amountCents("valor", raw.valor ?? "");
  const categoria = b.require("categoria", raw.categoria ?? "");
  const conta = b.require("conta", raw.conta ?? "");
  const nota = b.optional(raw.nota ?? "");

  return b.result({
    idExterno: idExterno ?? "",
    data: data ?? "",
    descricao: descricao ?? "",
    valorCents: valorCents ?? 0,
    categoria: categoria ?? "",
    conta: conta ?? "",
    nota,
  });
}

export interface TransferenciaRow {
  idExterno: string;
  data: string;
  valorCents: number;
  contaOrigem: string;
  contaDestino: string;
  nota: string | null;
}

export function validateTransferenciaRow(raw: Record<string, string>): RowResult<TransferenciaRow> {
  const b = new RowBuilder();
  const idExterno = b.require("id_externo", raw.id_externo ?? "");
  const data = b.date("data", raw.data ?? "");
  const valorCents = b.amountCents("valor", raw.valor ?? "");
  const contaOrigem = b.require("conta_origem", raw.conta_origem ?? "");
  const contaDestino = b.require("conta_destino", raw.conta_destino ?? "");
  const nota = b.optional(raw.nota ?? "");

  if (contaOrigem && contaDestino && contaOrigem === contaDestino) {
    b.fail("conta_destino", "conta_origem e conta_destino devem ser diferentes.");
  }

  return b.result({
    idExterno: idExterno ?? "",
    data: data ?? "",
    valorCents: valorCents ?? 0,
    contaOrigem: contaOrigem ?? "",
    contaDestino: contaDestino ?? "",
    nota,
  });
}

export interface InvestimentoRow {
  idExterno: string;
  data: string;
  valorCents: number;
  investimento: string;
  conta: string;
  direcao: "entrada" | "saida";
  nota: string | null;
}

export function validateInvestimentoRow(raw: Record<string, string>): RowResult<InvestimentoRow> {
  const b = new RowBuilder();
  const idExterno = b.require("id_externo", raw.id_externo ?? "");
  const data = b.date("data", raw.data ?? "");
  const valorCents = b.amountCents("valor", raw.valor ?? "");
  const investimento = b.require("investimento", raw.investimento ?? "");
  const conta = b.require("conta", raw.conta ?? "");
  const direcao = b.enumField("direcao", raw.direcao ?? "", ["entrada", "saida"] as const);
  const nota = b.optional(raw.nota ?? "");

  return b.result({
    idExterno: idExterno ?? "",
    data: data ?? "",
    valorCents: valorCents ?? 0,
    investimento: investimento ?? "",
    conta: conta ?? "",
    direcao: (direcao ?? "entrada") as "entrada" | "saida",
    nota,
  });
}

export interface PorquinhoRow {
  idExterno: string;
  data: string;
  valorCents: number;
  porquinho: string;
  direcao: "entrada" | "saida";
  nota: string | null;
}

export function validatePorquinhoRow(raw: Record<string, string>): RowResult<PorquinhoRow> {
  const b = new RowBuilder();
  const idExterno = b.require("id_externo", raw.id_externo ?? "");
  const data = b.date("data", raw.data ?? "");
  const valorCents = b.amountCents("valor", raw.valor ?? "");
  const porquinho = b.require("porquinho", raw.porquinho ?? "");
  const direcao = b.enumField("direcao", raw.direcao ?? "", ["entrada", "saida"] as const);
  const nota = b.optional(raw.nota ?? "");

  return b.result({
    idExterno: idExterno ?? "",
    data: data ?? "",
    valorCents: valorCents ?? 0,
    porquinho: porquinho ?? "",
    direcao: (direcao ?? "entrada") as "entrada" | "saida",
    nota,
  });
}

export interface FaturaRow {
  idExterno: string;
  data: string;
  cartao: string;
  mesFatura: string;
  tipo: "pagamento" | "ajuste";
  valorCents: number;
  conta: string | null;
  descricao: string | null;
  categoria: string | null;
  nota: string | null;
}

const MES_FATURA_RE = /^\d{4}-\d{2}$/;

export function validateFaturaRow(raw: Record<string, string>): RowResult<FaturaRow> {
  const b = new RowBuilder();
  const idExterno = b.require("id_externo", raw.id_externo ?? "");
  const data = b.date("data", raw.data ?? "");
  const cartao = b.require("cartao", raw.cartao ?? "");
  const mesFaturaRaw = b.require("mes_fatura", raw.mes_fatura ?? "");
  let mesFatura = mesFaturaRaw;
  if (mesFaturaRaw && !MES_FATURA_RE.test(mesFaturaRaw)) {
    b.fail("mes_fatura", `mes_fatura deve estar no formato AAAA-MM (recebido "${mesFaturaRaw}").`);
    mesFatura = null;
  }
  const tipo = b.enumField("tipo", raw.tipo ?? "", ["pagamento", "ajuste"] as const);
  const valorCents = b.amountCents("valor", raw.valor ?? "");
  const conta = b.optional(raw.conta ?? "");
  const descricao = b.optional(raw.descricao ?? "");
  const categoria = b.optional(raw.categoria ?? "");
  const nota = b.optional(raw.nota ?? "");

  if (tipo === "pagamento" && !conta) b.fail("conta", "conta é obrigatória quando tipo=pagamento.");
  if (tipo === "ajuste" && !descricao) b.fail("descricao", "descricao é obrigatória quando tipo=ajuste.");
  if (tipo === "ajuste" && !categoria) b.fail("categoria", "categoria é obrigatória quando tipo=ajuste.");

  return b.result({
    idExterno: idExterno ?? "",
    data: data ?? "",
    cartao: cartao ?? "",
    mesFatura: mesFatura ?? "",
    tipo: (tipo ?? "pagamento") as "pagamento" | "ajuste",
    valorCents: valorCents ?? 0,
    conta,
    descricao,
    categoria,
    nota,
  });
}
