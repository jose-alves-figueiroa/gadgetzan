"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updatePreferences } from "@/lib/server/settings";

interface SettingsFormProps {
  monthStartDay: number;
  projectionMonths: number;
  cardUtilizationTarget: number;
  hideAmounts: boolean;
}

export function SettingsForm({
  monthStartDay: initialMonthStartDay,
  projectionMonths: initialProjectionMonths,
  cardUtilizationTarget: initialCardUtilizationTarget,
  hideAmounts: initialHideAmounts,
}: SettingsFormProps) {
  const [monthStartDay, setMonthStartDay] = useState(initialMonthStartDay);
  const [projectionMonths, setProjectionMonths] = useState(initialProjectionMonths);
  const [cardUtilizationTarget, setCardUtilizationTarget] = useState(initialCardUtilizationTarget);
  const [hideAmounts, setHideAmounts] = useState(initialHideAmounts);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timeout = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(timeout);
  }, [saved]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      await updatePreferences({ monthStartDay, projectionMonths, cardUtilizationTarget, hideAmounts });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar ajustes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-lg">
      <span className="text-navhead uppercase text-neutral-700">Preferências</span>
      <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
        <div className="flex flex-wrap gap-lg">
          <Field
            name="monthStartDay"
            label="Início do mês financeiro (dia)"
            type="number"
            min={1}
            max={28}
            value={monthStartDay}
            onChange={(e) => setMonthStartDay(Number(e.target.value))}
            required
          />
          <Field
            name="projectionMonths"
            label="Meses de projeção"
            type="number"
            min={1}
            max={24}
            value={projectionMonths}
            onChange={(e) => setProjectionMonths(Number(e.target.value))}
            required
          />
          <Field
            name="cardUtilizationTarget"
            label="Utilização recomendada do cartão (%)"
            type="number"
            min={1}
            max={100}
            value={cardUtilizationTarget}
            onChange={(e) => setCardUtilizationTarget(Number(e.target.value))}
            required
          />
        </div>

        {monthStartDay !== initialMonthStartDay ? (
          <p className="text-micro text-warn">
            Mudar o início do mês financeiro recalcula os agregados históricos — meses e totais já vistos podem mudar.
          </p>
        ) : null}

        <label className="flex items-center gap-sm text-row text-text">
          <input type="checkbox" checked={hideAmounts} onChange={(e) => setHideAmounts(e.target.checked)} />
          Ocultar valores na tela
        </label>

        {error ? <p className="text-micro text-neg">{error}</p> : null}
        <Button type="submit" disabled={saving} className="self-start">
          {saving ? "Salvando…" : saved ? "Salvo" : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}
