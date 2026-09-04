"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { updateInvestmentValue } from "@/lib/server/investments";
import { centsToDecimalString } from "@/lib/finance/money";

/** Manual revaluation (return/loss) or correcting a value entered wrong — a
 * contribution/withdrawal already keeps currentCents in sync on its own. */
export function UpdateInvestmentValueModal({ investmentId, currentCents }: { investmentId: string; currentCents: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      await updateInvestmentValue({
        id: investmentId,
        currentCents: String(formData.get("currentCents") ?? ""),
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar valor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Atualizar valor
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Atualizar valor atual">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <p className="text-micro text-dim">
            Pra refletir um rendimento, perda ou corrigir um valor lançado errado — não mexe em nenhum lançamento,
            só no valor atual do investimento.
          </p>
          <Field name="currentCents" label="Valor atual" placeholder="0,00" defaultValue={centsToDecimalString(currentCents)} required />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
