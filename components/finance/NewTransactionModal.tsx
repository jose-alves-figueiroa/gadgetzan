"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatBRL, toCents, centsToDecimalString } from "@/lib/finance/money";
import { todayDateString } from "@/lib/today";
import { createTransaction, createTransfer, createInvestmentMove } from "@/lib/server/transactions";
import { markCreated } from "@/components/ui/HighlightOnCreate";
import { getCardImpactPreview, type CardImpactPreview } from "@/lib/server/transaction-impact";

interface Option {
  id: string;
  name: string;
}

interface CardOption extends Option {
  closingDay: number;
  dueDay: number;
}

interface CategoryOption extends Option {
  nature: "FIXED" | "VARIABLE" | "COMMITMENT" | "INCOME";
}

type TxType = "EXPENSE" | "INCOME" | "TRANSFER" | "INVESTMENT_IN" | "INVESTMENT_OUT";

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "EXPENSE", label: "Despesa" },
  { value: "INCOME", label: "Receita" },
  { value: "TRANSFER", label: "Transf." },
  { value: "INVESTMENT_IN", label: "Invest." },
  { value: "INVESTMENT_OUT", label: "Resgate" },
];

export function NewTransactionModal({
  open,
  onClose,
  categories,
  accounts,
  cards,
  investments,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  accounts: Option[];
  cards: CardOption[];
  investments: Option[];
}) {
  const [type, setType] = useState<TxType>("EXPENSE");
  const [method, setMethod] = useState<"ACCOUNT" | "CARD">("ACCOUNT");
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [amountInput, setAmountInput] = useState("");
  const [installments, setInstallments] = useState(1);
  const [amountMode, setAmountMode] = useState<"TOTAL" | "PER_INSTALLMENT">("TOTAL");
  const [date, setDate] = useState(todayDateString());
  const [isFixed, setIsFixed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [impact, setImpact] = useState<CardImpactPreview | null>(null);

  // "3x de R$100" (per-installment, total R$300) vs the total split across
  // installments (R$100 ÷ 3 ≈ R$33,33 each) — only ambiguous with 2+
  // installments, and always resolves to the TOTAL the server expects.
  const isPerInstallment = method === "CARD" && installments > 1 && amountMode === "PER_INSTALLMENT";
  const safeAmountCents = (() => {
    try {
      return toCents(amountInput);
    } catch {
      return 0;
    }
  })();

  function resolveTotalAmountInput(): string {
    if (!isPerInstallment || !amountInput) return amountInput;
    try {
      return centsToDecimalString(toCents(amountInput) * installments);
    } catch {
      return amountInput;
    }
  }

  useEffect(() => {
    if (!cards.some((c) => c.id === cardId)) {
      setCardId(cards[0]?.id ?? "");
    }
  }, [cards, cardId]);

  useEffect(() => {
    if (type !== "EXPENSE" || method !== "CARD" || !cardId || !amountInput) {
      setImpact(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const cents = toCents(resolveTotalAmountInput());
        const preview = await getCardImpactPreview(cardId, cents, installments, date);
        setImpact(preview);
      } catch {
        setImpact(null);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [type, method, cardId, amountInput, installments, date, amountMode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);

    try {
      if (type === "TRANSFER") {
        const transaction = await createTransfer({
          accountId: String(formData.get("accountId") ?? ""),
          toAccountId: String(formData.get("toAccountId") ?? ""),
          amountCents: amountInput,
          competenceDate: date,
          note: null,
        });
        markCreated(transaction.id);
      } else if (type === "INVESTMENT_IN" || type === "INVESTMENT_OUT") {
        const transaction = await createInvestmentMove({
          kind: type,
          investmentId: String(formData.get("investmentId") ?? ""),
          accountId: String(formData.get("accountId") ?? ""),
          amountCents: amountInput,
          competenceDate: date,
        });
        markCreated(transaction.id);
      } else {
        const transaction = await createTransaction({
          kind: type,
          description: String(formData.get("description") ?? ""),
          amountCents: resolveTotalAmountInput(),
          competenceDate: date,
          categoryId: String(formData.get("categoryId") ?? ""),
          method,
          accountId: method === "ACCOUNT" ? String(formData.get("accountId") ?? "") : null,
          cardId: method === "CARD" ? cardId : null,
          installments: method === "CARD" ? installments : 1,
          isFixed,
          note: null,
        });
        if (transaction) markCreated(transaction.id);
      }
      onClose();
      (event.target as HTMLFormElement).reset();
      setAmountInput("");
      setInstallments(1);
      setAmountMode("TOTAL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo lançamento">
      <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
        <Segmented options={TYPE_OPTIONS} value={type} onChange={(v) => setType(v as TxType)} />

        {type !== "TRANSFER" && type !== "INVESTMENT_IN" && type !== "INVESTMENT_OUT" ? (
          <Field name="description" label="Descrição" required />
        ) : null}

        <Field
          label={isPerInstallment ? "Valor de cada parcela" : "Valor"}
          placeholder="0,00"
          required
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
        />

        <Field name="date" label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

        {(type === "EXPENSE" || type === "INCOME") && (
          <>
            <div className="flex flex-col gap-xs">
              <label htmlFor="categoryId" className="text-micro text-text/70">
                Categoria
              </label>
              <select
                id="categoryId"
                name="categoryId"
                required
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {categories
                  .filter((c) => (type === "INCOME" ? c.nature === "INCOME" : c.nature !== "INCOME"))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <Segmented
              options={[
                { value: "ACCOUNT", label: "Débito/Pix" },
                { value: "CARD", label: "Cartão" },
              ]}
              value={method}
              onChange={(v) => setMethod(v as typeof method)}
            />

            {method === "ACCOUNT" ? (
              <div className="flex flex-col gap-xs">
                <label htmlFor="accountId" className="text-micro text-text/70">
                  Conta
                </label>
                <select
                  id="accountId"
                  name="accountId"
                  required
                  className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cardSelect" className="text-micro text-text/70">
                    Cartão
                  </label>
                  <select
                    id="cardSelect"
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Parcelas"
                  type="number"
                  min={1}
                  max={48}
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  hint={
                    installments > 1 && amountInput ? (
                      amountMode === "TOTAL" ? (
                        <>
                          {installments}× de aprox.{" "}
                          <span className="tabular-money">{formatBRL(Math.floor(safeAmountCents / installments))}</span>
                        </>
                      ) : (
                        <>
                          Total da compra:{" "}
                          <span className="tabular-money">{formatBRL(safeAmountCents * installments)}</span>
                        </>
                      )
                    ) : undefined
                  }
                />
                {installments > 1 ? (
                  <div className="flex flex-col gap-xs">
                    <span className="text-micro text-text/70">O valor acima é</span>
                    <Segmented
                      options={[
                        { value: "TOTAL", label: "O total da compra" },
                        { value: "PER_INSTALLMENT", label: "De cada parcela" },
                      ]}
                      value={amountMode}
                      onChange={(v) => setAmountMode(v as typeof amountMode)}
                    />
                  </div>
                ) : null}
              </>
            )}

            <label className="flex items-center gap-sm text-row text-text">
              <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} />
              <Tooltip label="Despesa fixa">
                Só um rótulo neste lançamento — não afeta relatórios ou projeções. Não é recorrente: pra um gasto
                que se repete todo mês, cadastre uma recorrência em vez disso.
              </Tooltip>
            </label>

            {impact ? (
              <div className="flex flex-col gap-xs rounded-md bg-tile p-md text-micro text-muted">
                <span className="text-dim uppercase tracking-wide">Impacto ao salvar</span>
                <span>
                  Fatura atual:{" "}
                  <span className="tabular-money">
                    {formatBRL(impact.currentInvoiceBeforeCents)} → {formatBRL(impact.currentInvoiceAfterCents)}
                  </span>
                </span>
                <span>
                  Próxima fatura:{" "}
                  <span className="tabular-money">
                    {formatBRL(impact.nextInvoiceBeforeCents)} → {formatBRL(impact.nextInvoiceAfterCents)}
                  </span>
                </span>
                <span>
                  Limite disponível:{" "}
                  <span className="tabular-money">
                    {formatBRL(impact.availableBeforeCents)} → {formatBRL(impact.availableAfterCents)}
                  </span>
                </span>
              </div>
            ) : null}
          </>
        )}

        {type === "TRANSFER" && (
          <>
            <div className="flex flex-col gap-xs">
              <label htmlFor="accountId" className="text-micro text-text/70">
                Conta de origem
              </label>
              <select
                id="accountId"
                name="accountId"
                required
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label htmlFor="toAccountId" className="text-micro text-text/70">
                Conta de destino
              </label>
              <select
                id="toAccountId"
                name="toAccountId"
                required
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-micro text-dim">Não entra em receitas nem despesas — apenas move dinheiro entre contas.</p>
          </>
        )}

        {(type === "INVESTMENT_IN" || type === "INVESTMENT_OUT") && (
          <>
            <div className="flex flex-col gap-xs">
              <label htmlFor="investmentId" className="text-micro text-text/70">
                Investimento
              </label>
              <select
                id="investmentId"
                name="investmentId"
                required
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {investments.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label htmlFor="accountId" className="text-micro text-text/70">
                Conta
              </label>
              <select
                id="accountId"
                name="accountId"
                required
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {error ? <p className="text-micro text-neg">{error}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </form>
    </Modal>
  );
}
