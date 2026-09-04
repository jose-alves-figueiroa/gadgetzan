"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { enterPastInvoice } from "@/lib/server/invoice-operations";

function centsToInputValue(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Enters (or, via `enterPastInvoice`'s upsert on cardId+referenceMonth,
 * corrects) an invoice's manually-entered total — used both for a month
 * before the app was in use and, with different labels/defaultValueCents,
 * for fixing a manual total that was typed wrong.
 */
export function EnterPastInvoiceModal({
  cardId,
  referenceMonth,
  monthLabel,
  triggerLabel = "Lançar fatura já existente",
  title = "Lançar fatura já existente",
  defaultValueCents,
}: {
  cardId: string;
  referenceMonth: string;
  monthLabel: string;
  triggerLabel?: string;
  title?: string;
  defaultValueCents?: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      await enterPastInvoice({
        cardId,
        referenceMonth,
        totalCents: String(formData.get("totalCents") ?? ""),
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao lançar fatura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <p className="text-micro text-dim">
            Pra quando você já tem um saldo em aberto nesse cartão de antes de começar a usar o app — não cria
            nenhum lançamento de despesa, só registra o total devido em <span className="capitalize">{monthLabel}</span>.
          </p>
          <Field
            name="totalCents"
            label="Total da fatura"
            placeholder="0,00"
            defaultValue={defaultValueCents !== undefined ? centsToInputValue(defaultValueCents) : undefined}
            required
          />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
