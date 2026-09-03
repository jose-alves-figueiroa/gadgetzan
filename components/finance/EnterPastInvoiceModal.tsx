"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { enterPastInvoice } from "@/lib/server/invoice-operations";

export function EnterPastInvoiceModal({
  cardId,
  referenceMonth,
  monthLabel,
}: {
  cardId: string;
  referenceMonth: string;
  monthLabel: string;
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
        Lançar fatura já existente
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Lançar fatura já existente">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <p className="text-micro text-dim">
            Pra quando você já tem um saldo em aberto nesse cartão de antes de começar a usar o app — não cria
            nenhum lançamento de despesa, só registra o total devido em <span className="capitalize">{monthLabel}</span>.
          </p>
          <Field name="totalCents" label="Total da fatura" placeholder="0,00" required />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
