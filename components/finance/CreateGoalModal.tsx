"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createGoal } from "@/lib/server/goals";

const ICONS = ["🐷", "✈️", "🏠", "🚗", "🎓", "💍", "🏖️", "🎁"];

export function CreateGoalModal({
  accounts,
  investments,
  triggerLabel = "Criar porquinho",
}: {
  accounts: { id: string; nickname: string }[];
  investments: { id: string; name: string }[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(ICONS[0]);
  const [source, setSource] = useState<"account" | "investment">("account");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      await createGoal({
        name: String(formData.get("name") ?? ""),
        icon,
        targetCents: String(formData.get("targetCents") ?? ""),
        targetDate: String(formData.get("targetDate") ?? "") || null,
        monthlyTargetCents: String(formData.get("monthlyTargetCents") ?? "") || null,
        accountId: source === "account" ? String(formData.get("accountId") ?? "") : null,
        investmentId: source === "investment" ? String(formData.get("investmentId") ?? "") : null,
      });
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar porquinho.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo porquinho">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <span className="text-micro text-text/70">Ícone</span>
            <div className="flex gap-xs">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border text-body ${
                    icon === i ? "border-accent bg-accent/12" : "border-line"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <Field name="name" label="Nome" required />
          <Field name="targetCents" label="Valor alvo" placeholder="0,00" required />
          <Field name="targetDate" label="Prazo (opcional)" type="date" />
          <Field name="monthlyTargetCents" label="Aporte mensal alvo (opcional)" placeholder="0,00" />

          <div className="flex flex-col gap-xs">
            <span className="text-micro text-text/70">Onde fica guardado</span>
            <div className="flex gap-md">
              <label className="flex items-center gap-xs text-row text-text">
                <input type="radio" checked={source === "account"} onChange={() => setSource("account")} />
                Conta
              </label>
              <label className="flex items-center gap-xs text-row text-text">
                <input type="radio" checked={source === "investment"} onChange={() => setSource("investment")} />
                Investimento
              </label>
            </div>
          </div>

          {source === "account" ? (
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
          ) : (
            <div className="flex flex-col gap-xs">
              <label htmlFor="investmentId" className="text-micro text-text/70">
                Investimento
              </label>
              <select
                id="investmentId"
                name="investmentId"
                required
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {investments.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-micro text-dim">
            Um porquinho é uma reserva lógica — guardar não move dinheiro de verdade (R9).
          </p>

          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
