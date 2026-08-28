"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { createAccount } from "@/lib/server/accounts";

const TYPE_OPTIONS = [
  { value: "CHECKING", label: "Conta corrente" },
  { value: "SAVINGS", label: "Poupança" },
  { value: "PAYMENT", label: "Conta de pagamento" },
] as const;

export function CreateAccountModal({ triggerLabel = "Nova conta" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]["value"]>("CHECKING");
  const [includeInTotals, setIncludeInTotals] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    try {
      await createAccount({
        institution: String(formData.get("institution") ?? ""),
        nickname: String(formData.get("nickname") ?? ""),
        type,
        openingBalance: String(formData.get("openingBalance") ?? ""),
        openingDate: String(formData.get("openingDate") ?? ""),
        includeInTotals,
      });
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova conta">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="institution" label="Instituição" required />
          <Field name="nickname" label="Apelido" required />
          <div className="flex flex-col gap-xs">
            <span className="text-micro text-text/70">Tipo</span>
            <Segmented options={TYPE_OPTIONS as unknown as { value: string; label: string }[]} value={type} onChange={(v) => setType(v as typeof type)} />
          </div>
          <Field name="openingBalance" label="Saldo atual" placeholder="0,00" required />
          <Field name="openingDate" label="Data" type="date" required />
          <label className="flex items-center gap-sm text-row text-text">
            <input
              type="checkbox"
              checked={includeInTotals}
              onChange={(e) => setIncludeInTotals(e.target.checked)}
            />
            Incluir nos totais
          </label>
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
