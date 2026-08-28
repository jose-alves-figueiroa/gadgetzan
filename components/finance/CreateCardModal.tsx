"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createCard } from "@/lib/server/cards";

interface AccountOption {
  id: string;
  nickname: string;
}

export function CreateCardModal({
  accounts,
  triggerLabel = "Novo cartão",
}: {
  accounts: AccountOption[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closingDay, setClosingDay] = useState(1);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    try {
      await createCard({
        accountId: String(formData.get("accountId") ?? ""),
        name: String(formData.get("name") ?? ""),
        limitCents: String(formData.get("limitCents") ?? ""),
        closingDay: Number(formData.get("closingDay")),
        dueDay: Number(formData.get("dueDay")),
        utilizationTarget: null,
      });
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cartão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo cartão">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="name" label="Nome" required />
          <div className="flex flex-col gap-xs">
            <label htmlFor="accountId" className="text-micro text-text/70">
              Conta de débito
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
          <Field name="limitCents" label="Limite" placeholder="0,00" required />
          <div className="flex gap-lg">
            <Field
              name="closingDay"
              label="Dia de fechamento"
              type="number"
              min={1}
              max={28}
              required
              value={closingDay}
              onChange={(e) => setClosingDay(Number(e.target.value))}
            />
            <Field name="dueDay" label="Dia de vencimento" type="number" min={1} max={28} required />
          </div>
          <p className="text-micro text-dim">
            Compras feitas até o dia {closingDay} entram na fatura deste mês; depois disso, na próxima.
          </p>
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving || accounts.length === 0}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          {accounts.length === 0 ? (
            <p className="text-micro text-neg">Crie uma conta antes de cadastrar um cartão.</p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
