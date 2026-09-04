"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { updateAccountOpeningBalance } from "@/lib/server/accounts";
import { centsToDecimalString } from "@/lib/finance/money";

export function EditAccountBalanceModal({
  accountId,
  openingBalanceCents,
  openingDate,
}: {
  accountId: string;
  openingBalanceCents: number;
  openingDate: string;
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
      await updateAccountOpeningBalance({
        id: accountId,
        openingBalance: String(formData.get("openingBalance") ?? ""),
        openingDate: String(formData.get("openingDate") ?? ""),
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao editar saldo inicial.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Editar saldo inicial
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Editar saldo inicial">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <p className="text-micro text-dim">
            O saldo atual é sempre calculado a partir daqui (saldo inicial + lançamentos desde essa data) — corrigir
            aqui muda todo o histórico já calculado da conta.
          </p>
          <Field
            name="openingBalance"
            label="Saldo inicial"
            placeholder="0,00"
            defaultValue={centsToDecimalString(openingBalanceCents)}
            required
          />
          <Field name="openingDate" label="Data" type="date" defaultValue={openingDate} required />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
