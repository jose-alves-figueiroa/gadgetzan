"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createInvestment } from "@/lib/server/investments";

const KIND_OPTIONS = [
  { value: "FIXED_INCOME", label: "Renda fixa" },
  { value: "TREASURY", label: "Tesouro" },
  { value: "FUND", label: "Fundo" },
  { value: "STOCKS", label: "Ações" },
  { value: "OTHER", label: "Outro" },
] as const;

export function CreateInvestmentModal({
  accounts,
  triggerLabel = "Novo investimento",
}: {
  accounts: { id: string; nickname: string }[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debitNow, setDebitNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    try {
      await createInvestment({
        name: String(formData.get("name") ?? ""),
        kind: String(formData.get("kind") ?? "OTHER") as (typeof KIND_OPTIONS)[number]["value"],
        accountId: String(formData.get("accountId") ?? ""),
        appliedCents: String(formData.get("appliedCents") ?? ""),
        currentCents: String(formData.get("currentCents") ?? formData.get("appliedCents") ?? ""),
        liquidity: String(formData.get("liquidity") ?? "") || null,
        debitNow,
      });
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar investimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo investimento">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="name" label="Nome" required />
          <div className="flex flex-col gap-xs">
            <label htmlFor="kind" className="text-micro text-text/70">
              Tipo
            </label>
            <select
              id="kind"
              name="kind"
              className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
                  {a.nickname}
                </option>
              ))}
            </select>
          </div>
          <Field name="appliedCents" label="Valor aplicado" placeholder="0,00" required />
          <Field name="currentCents" label="Valor atual" placeholder="igual ao aplicado" />
          <Field name="liquidity" label="Liquidez (opcional)" placeholder="D+0, D+30…" />
          <label className="flex items-center gap-sm text-row text-text">
            <input type="checkbox" checked={debitNow} onChange={(e) => setDebitNow(e.target.checked)} />
            Debitar o aporte da conta agora
          </label>
          <p className="text-micro text-dim">
            Um aporte não conta como despesa — apenas move dinheiro entre conta e investimento (R1).
          </p>
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving || accounts.length === 0}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
