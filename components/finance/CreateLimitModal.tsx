"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { createLimit } from "@/lib/server/limits";
import { markCreated } from "@/components/ui/HighlightOnCreate";

type Scope = "TOTAL_MONTH" | "CATEGORY" | "CARD_UTILIZATION";

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "TOTAL_MONTH", label: "Total do mês" },
  { value: "CATEGORY", label: "Categoria" },
  { value: "CARD_UTILIZATION", label: "Utilização do cartão" },
];

export function CreateLimitModal({
  categories,
  cards,
}: {
  categories: { id: string; name: string }[];
  cards: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("CATEGORY");
  const [includeCommitments, setIncludeCommitments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      const limit = await createLimit({
        scope,
        categoryId: scope === "CATEGORY" ? String(formData.get("categoryId") ?? "") : null,
        cardId: scope === "CARD_UTILIZATION" ? String(formData.get("cardId") ?? "") : null,
        amountCents: scope === "CARD_UTILIZATION" ? null : String(formData.get("amountCents") ?? ""),
        percentValue: scope === "CARD_UTILIZATION" ? Number(formData.get("percent") ?? 0) : null,
        warnAtPercent: Number(formData.get("warnAtPercent") ?? 80),
        includeCommitments,
      });
      markCreated(limit.id);
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar limite.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Novo limite</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo limite">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Segmented options={SCOPE_OPTIONS} value={scope} onChange={(v) => setScope(v as Scope)} />

          {scope === "CATEGORY" ? (
            <div className="flex flex-col gap-xs">
              <label htmlFor="categoryId" className="text-micro text-text/70">
                Categoria
              </label>
              <select
                id="categoryId"
                name="categoryId"
                required
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {scope === "CARD_UTILIZATION" ? (
            <>
              <div className="flex flex-col gap-xs">
                <label htmlFor="cardId" className="text-micro text-text/70">
                  Cartão
                </label>
                <select
                  id="cardId"
                  name="cardId"
                  required
                  className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field name="percent" label="Meta de utilização (%)" type="number" min={1} max={100} defaultValue={70} required />
            </>
          ) : (
            <Field name="amountCents" label="Valor" placeholder="0,00" required />
          )}

          <Field name="warnAtPercent" label="Avisar em (%)" type="number" min={1} max={100} defaultValue={80} required />

          {scope === "TOTAL_MONTH" ? (
            <label className="flex items-center gap-sm text-row text-text">
              <input type="checkbox" checked={includeCommitments} onChange={(e) => setIncludeCommitments(e.target.checked)} />
              Incluir compromissos no total
            </label>
          ) : null}

          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
