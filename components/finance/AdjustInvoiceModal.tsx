"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { adjustInvoice } from "@/lib/server/invoice-operations";

export function AdjustInvoiceModal({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      await adjustInvoice({
        invoiceId,
        amountCents: String(formData.get("amountCents") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ajustar fatura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Ajustar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ajustar fatura">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="amountCents" label="Valor" placeholder="0,00" required />
          <Field name="reason" label="Motivo" placeholder="Juros, tarifa, estorno…" required />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
