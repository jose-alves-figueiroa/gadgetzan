"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { createCategory } from "@/lib/server/categories";
import { markCreated } from "@/components/ui/HighlightOnCreate";

const NATURE_OPTIONS = [
  { value: "FIXED", label: "Fixa" },
  { value: "VARIABLE", label: "Variável" },
  { value: "COMMITMENT", label: "Compromisso" },
  { value: "INCOME", label: "Receita" },
] as const;

export function CreateCategoryModal({ triggerLabel = "Nova categoria" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [nature, setNature] = useState<(typeof NATURE_OPTIONS)[number]["value"]>("VARIABLE");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    const limitInput = String(formData.get("limitAmountCents") ?? "").trim();

    try {
      const category = await createCategory({
        name: String(formData.get("name") ?? ""),
        nature,
        icon: String(formData.get("icon") ?? "tag"),
        limitAmountCents: limitInput || null,
      });
      markCreated(category.id);
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar categoria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova categoria">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="name" label="Nome" required />
          <div className="flex flex-col gap-xs">
            <span className="text-micro text-text/70">Natureza</span>
            <Segmented
              options={NATURE_OPTIONS as unknown as { value: string; label: string }[]}
              value={nature}
              onChange={(v) => setNature(v as typeof nature)}
            />
          </div>
          <Field name="icon" label="Ícone (Phosphor)" placeholder="tag" defaultValue="tag" />
          <Field name="limitAmountCents" label="Limite (opcional)" placeholder="0,00" />
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
