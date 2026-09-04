"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { payPurchaseRemaining } from "@/lib/server/purchases";
import { formatBRL } from "@/lib/finance/money";
import { todayDateString } from "@/lib/today";

export function PayPurchaseRemainingModal({
  purchaseId,
  remainingCents,
  accounts,
}: {
  purchaseId: string;
  remainingCents: number;
  accounts: { id: string; nickname: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      await payPurchaseRemaining({
        purchaseId,
        accountId: String(formData.get("accountId") ?? ""),
        paidDate: String(formData.get("paidDate") ?? ""),
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao antecipar parcelas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Antecipar parcelas restantes
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Antecipar parcelas">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <p className="text-row text-muted">
            Saldo restante: <span className="tabular-money text-text">{formatBRL(remainingCents)}</span>
          </p>
          <p className="text-micro text-dim">
            As parcelas continuam registradas nos meses originais — só o pagamento é antecipado, debitando a conta
            escolhida hoje e liberando o limite do cartão na hora.
          </p>
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
          <Field name="paidDate" label="Data" type="date" defaultValue={todayDateString()} required />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Confirmar antecipação"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
