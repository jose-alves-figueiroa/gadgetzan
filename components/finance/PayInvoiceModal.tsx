"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { payInvoice } from "@/lib/server/invoice-operations";
import { formatBRL } from "@/lib/finance/money";

export function PayInvoiceModal({
  invoiceId,
  outstandingCents,
  accounts,
}: {
  invoiceId: string;
  outstandingCents: number;
  accounts: { id: string; nickname: string }[];
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
      await payInvoice({
        invoiceId,
        accountId: String(formData.get("accountId") ?? ""),
        paidCents: String(formData.get("paidCents") ?? ""),
        paidDate: String(formData.get("paidDate") ?? new Date().toISOString().slice(0, 10)),
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao pagar fatura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Pagar fatura</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Pagar fatura">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <p className="text-row text-muted">Em aberto: {formatBRL(outstandingCents)}</p>
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
          <Field
            name="paidCents"
            label="Valor pago"
            placeholder="0,00"
            defaultValue={(outstandingCents / 100).toFixed(2).replace(".", ",")}
            required
          />
          <Field name="paidDate" label="Data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Confirmar pagamento"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
