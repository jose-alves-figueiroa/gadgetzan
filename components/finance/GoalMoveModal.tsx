"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { contributeToGoal, withdrawFromGoal } from "@/lib/server/goals";

export function GoalMoveModal({ goalId, kind }: { goalId: string; kind: "save" | "withdraw" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      const payload = {
        goalId,
        amountCents: String(formData.get("amountCents") ?? ""),
        competenceDate: String(formData.get("competenceDate") ?? new Date().toISOString().slice(0, 10)),
      };
      if (kind === "save") await contributeToGoal(payload);
      else await withdrawFromGoal(payload);
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const title = kind === "save" ? "Guardar" : "Resgatar";

  return (
    <>
      <Button variant={kind === "save" ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        {title}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="amountCents" label="Valor" placeholder="0,00" required />
          <Field name="competenceDate" label="Data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Confirmar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
