"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { createRecurrenceRule } from "@/lib/server/recurrences";
import { markCreated } from "@/components/ui/HighlightOnCreate";
import { generateOccurrences } from "@/lib/finance/recurrence";
import { addMonths, formatDateParts, parseDateParts } from "@/lib/finance/period";

interface Option {
  id: string;
  name: string;
}

export function CreateRecurrenceModal({
  categories,
  accounts,
  cards,
  triggerLabel = "Nova recorrência",
}: {
  categories: Option[];
  accounts: Option[];
  cards: Option[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY" | "YEARLY">("MONTHLY");
  const [method, setMethod] = useState<"ACCOUNT" | "CARD">("ACCOUNT");
  const [dayOfMonth, setDayOfMonth] = useState(5);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    if (frequency !== "MONTHLY" || !startDate) return [];
    const rangeEndParts = addMonths(parseDateParts(startDate), 3);
    const rangeEnd = formatDateParts({ ...rangeEndParts, day: 28 });
    return generateOccurrences(
      { frequency, dayOfMonth, startDate, status: "ACTIVE" },
      startDate,
      rangeEnd
    ).slice(0, 3);
  }, [frequency, dayOfMonth, startDate]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    try {
      const rule = await createRecurrenceRule({
        kind,
        description: String(formData.get("description") ?? ""),
        amountCents: String(formData.get("amountCents") ?? ""),
        frequency,
        dayOfMonth: frequency !== "WEEKLY" ? dayOfMonth : null,
        weekday: frequency === "WEEKLY" ? Number(formData.get("weekday") ?? 0) : null,
        monthOfYear: frequency === "YEARLY" ? Number(formData.get("monthOfYear") ?? 1) : null,
        categoryId: String(formData.get("categoryId") ?? ""),
        method,
        accountId: method === "ACCOUNT" ? String(formData.get("accountId") ?? "") : null,
        cardId: method === "CARD" ? String(formData.get("cardId") ?? "") : null,
        startDate,
        endDate: null,
      });
      markCreated(rule.id);
      setOpen(false);
      (event.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar recorrência.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova recorrência">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Segmented
            options={[
              { value: "INCOME", label: "Receita" },
              { value: "EXPENSE", label: "Despesa" },
            ]}
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
          />
          <Field name="description" label="Nome" required />
          <Field name="amountCents" label="Valor" placeholder="0,00" required />

          <Segmented
            options={[
              { value: "MONTHLY", label: "Mensal" },
              { value: "WEEKLY", label: "Semanal" },
              { value: "YEARLY", label: "Anual" },
            ]}
            value={frequency}
            onChange={(v) => setFrequency(v as typeof frequency)}
          />

          {frequency !== "WEEKLY" ? (
            <Field
              name="dayOfMonth"
              label="Dia"
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
            />
          ) : (
            <div className="flex flex-col gap-xs">
              <label htmlFor="weekday" className="text-micro text-text/70">
                Dia da semana
              </label>
              <select
                id="weekday"
                name="weekday"
                className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
              >
                {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {frequency === "YEARLY" ? (
            <Field name="monthOfYear" label="Mês do ano" type="number" min={1} max={12} defaultValue={1} />
          ) : null}

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

          <Segmented
            options={[
              { value: "ACCOUNT", label: "Conta" },
              { value: "CARD", label: "Cartão" },
            ]}
            value={method}
            onChange={(v) => setMethod(v as typeof method)}
          />

          {method === "ACCOUNT" ? (
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
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
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
          )}

          <Field
            name="startDate"
            label="Início"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          {preview.length > 0 ? (
            <div className="flex flex-col gap-xs rounded-md bg-tile p-md">
              <span className="text-micro text-dim">Próximas ocorrências</span>
              <span className="text-row text-text">{preview.join(" · ")}</span>
              <span className="text-micro text-dim">Vai aparecer nas projeções a partir de agora.</span>
            </div>
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
