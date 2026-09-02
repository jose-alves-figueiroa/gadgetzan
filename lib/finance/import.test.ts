import { describe, expect, it } from "vitest";
import {
  validateDespesaRow,
  validateFaturaRow,
  validateInvestimentoRow,
  validatePorquinhoRow,
  validateReceitaRow,
  validateTransferenciaRow,
} from "./import";

describe("R15 — despesas.csv row validation", () => {
  it("accepts a simple account expense", () => {
    const result = validateDespesaRow({
      id_externo: "ext-1",
      data: "2026-08-01",
      descricao: "Mercado",
      valor: "150,00",
      categoria: "Alimentação",
      metodo: "conta",
      conta: "Nubank",
      cartao: "",
      parcela_atual: "",
      total_parcelas: "",
      nota: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.row.valorCents).toBe(15_000);
      expect(result.row.parcelas).toBeNull();
    }
  });

  it("rejects metodo=conta with no conta", () => {
    const result = validateDespesaRow({
      id_externo: "ext-1",
      data: "2026-08-01",
      descricao: "Mercado",
      valor: "150,00",
      categoria: "Alimentação",
      metodo: "conta",
      conta: "",
      cartao: "",
      parcela_atual: "",
      total_parcelas: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === "conta")).toBe(true);
  });

  it("rejects a valor with the wrong decimal format", () => {
    const result = validateDespesaRow({
      id_externo: "ext-1",
      data: "2026-08-01",
      descricao: "Mercado",
      valor: "150.00",
      categoria: "Alimentação",
      metodo: "conta",
      conta: "Nubank",
      cartao: "",
      parcela_atual: "",
      total_parcelas: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === "valor")).toBe(true);
  });

  it("rejects a date in DD/MM/YYYY format", () => {
    const result = validateDespesaRow({
      id_externo: "ext-1",
      data: "01/08/2026",
      descricao: "Mercado",
      valor: "150,00",
      categoria: "Alimentação",
      metodo: "conta",
      conta: "Nubank",
      cartao: "",
      parcela_atual: "",
      total_parcelas: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === "data")).toBe(true);
  });

  it("accepts a card expense with parcela_atual/total_parcelas (2 of 4)", () => {
    const result = validateDespesaRow({
      id_externo: "ext-2",
      data: "2026-08-20",
      descricao: "Vôo REC-RJ",
      valor: "368,08",
      categoria: "Viagem",
      metodo: "cartao",
      conta: "",
      cartao: "Nubank",
      parcela_atual: "2",
      total_parcelas: "4",
      nota: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.parcelas).toEqual({ atual: 2, total: 4 });
  });

  it("rejects parcela_atual filled without total_parcelas", () => {
    const result = validateDespesaRow({
      id_externo: "ext-2",
      data: "2026-08-20",
      descricao: "Vôo REC-RJ",
      valor: "368,08",
      categoria: "Viagem",
      metodo: "cartao",
      conta: "",
      cartao: "Nubank",
      parcela_atual: "2",
      total_parcelas: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === "parcela_atual")).toBe(true);
  });

  it("rejects parcela_atual greater than total_parcelas", () => {
    const result = validateDespesaRow({
      id_externo: "ext-2",
      data: "2026-08-20",
      descricao: "Vôo REC-RJ",
      valor: "368,08",
      categoria: "Viagem",
      metodo: "cartao",
      conta: "",
      cartao: "Nubank",
      parcela_atual: "5",
      total_parcelas: "4",
      nota: "",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects parcelas on a metodo=conta row", () => {
    const result = validateDespesaRow({
      id_externo: "ext-2",
      data: "2026-08-20",
      descricao: "Vôo REC-RJ",
      valor: "368,08",
      categoria: "Viagem",
      metodo: "conta",
      conta: "Nubank",
      cartao: "",
      parcela_atual: "2",
      total_parcelas: "4",
      nota: "",
    });
    expect(result.ok).toBe(false);
  });

  it("accumulates every field error at once, not just the first", () => {
    const result = validateDespesaRow({
      id_externo: "",
      data: "bad",
      descricao: "",
      valor: "bad",
      categoria: "",
      metodo: "boleto",
      conta: "",
      cartao: "",
      parcela_atual: "",
      total_parcelas: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe("R15 — receitas.csv row validation", () => {
  it("accepts a valid row", () => {
    const result = validateReceitaRow({
      id_externo: "r-1",
      data: "2026-08-05",
      descricao: "Salário",
      valor: "14000,00",
      categoria: "Salário",
      conta: "Nubank",
      nota: "",
    });
    expect(result.ok).toBe(true);
  });
});

describe("R15 — transferencias.csv row validation", () => {
  it("rejects conta_origem equal to conta_destino", () => {
    const result = validateTransferenciaRow({
      id_externo: "t-1",
      data: "2026-08-05",
      valor: "500,00",
      conta_origem: "Nubank",
      conta_destino: "Nubank",
      nota: "",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts distinct accounts", () => {
    const result = validateTransferenciaRow({
      id_externo: "t-1",
      data: "2026-08-05",
      valor: "500,00",
      conta_origem: "Nubank",
      conta_destino: "Inter",
      nota: "",
    });
    expect(result.ok).toBe(true);
  });
});

describe("R15 — investimentos.csv / porquinhos.csv row validation", () => {
  it("rejects an invalid direcao", () => {
    const result = validateInvestimentoRow({
      id_externo: "i-1",
      data: "2026-08-05",
      valor: "500,00",
      investimento: "Tesouro",
      conta: "Nubank",
      direcao: "deposito",
      nota: "",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts entrada/saida", () => {
    expect(
      validatePorquinhoRow({
        id_externo: "p-1",
        data: "2026-08-05",
        valor: "500,00",
        porquinho: "Viagem",
        direcao: "saida",
        nota: "",
      }).ok
    ).toBe(true);
  });
});

describe("R15 — faturas.csv row validation", () => {
  it("pagamento requires conta", () => {
    const result = validateFaturaRow({
      id_externo: "f-1",
      data: "2026-08-20",
      cartao: "Nubank",
      mes_fatura: "2026-08",
      tipo: "pagamento",
      valor: "1000,00",
      conta: "",
      descricao: "",
      categoria: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === "conta")).toBe(true);
  });

  it("ajuste requires descricao and categoria", () => {
    const result = validateFaturaRow({
      id_externo: "f-2",
      data: "2026-08-20",
      cartao: "Nubank",
      mes_fatura: "2026-08",
      tipo: "ajuste",
      valor: "50,00",
      conta: "",
      descricao: "",
      categoria: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "descricao")).toBe(true);
      expect(result.errors.some((e) => e.field === "categoria")).toBe(true);
    }
  });

  it("rejects mes_fatura in the wrong format", () => {
    const result = validateFaturaRow({
      id_externo: "f-3",
      data: "2026-08-20",
      cartao: "Nubank",
      mes_fatura: "08/2026",
      tipo: "pagamento",
      valor: "1000,00",
      conta: "Nubank",
      descricao: "",
      categoria: "",
      nota: "",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a valid pagamento row", () => {
    const result = validateFaturaRow({
      id_externo: "f-4",
      data: "2026-08-20",
      cartao: "Nubank",
      mes_fatura: "2026-08",
      tipo: "pagamento",
      valor: "1000,00",
      conta: "Nubank",
      descricao: "",
      categoria: "",
      nota: "",
    });
    expect(result.ok).toBe(true);
  });
});
