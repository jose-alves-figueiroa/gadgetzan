"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/finance/money";
import { pauseRecurrenceRule, endRecurrenceRule, confirmRecurrenceNow } from "@/lib/server/recurrences";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";

interface RecurrenceRowProps {
  id: string;
  description: string;
  amountCents: number;
  frequency: string;
  dayOfMonth: number | null;
  categoryName?: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  /** Next not-yet-confirmed occurrence date (ISO), for the "Confirmar agora" action. */
  nextOccurrenceDate?: string | null;
  className?: string;
}

export function RecurrenceRow({
  id,
  description,
  amountCents,
  frequency,
  dayOfMonth,
  categoryName,
  status,
  nextOccurrenceDate,
  className,
}: RecurrenceRowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePause() {
    setBusy(true);
    await pauseRecurrenceRule(id);
    setCurrentStatus("PAUSED");
    setBusy(false);
  }

  async function handleEnd() {
    setBusy(true);
    await endRecurrenceRule(id);
    setCurrentStatus("ENDED");
    setBusy(false);
  }

  async function handleConfirmNow() {
    setBusy(true);
    setError(null);
    try {
      await confirmRecurrenceNow(id);
      setConfirmed(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar recorrência.");
    } finally {
      setBusy(false);
    }
  }

  const [, nextMonth, nextDay] = nextOccurrenceDate ? nextOccurrenceDate.split("-") : [];

  return (
    <div className={cn("flex flex-col gap-xs px-md py-sm", currentStatus === "PAUSED" && "opacity-55", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-xs">
          <span className="text-row text-text">{description}</span>
          <span className="text-micro text-dim">
            {frequency === "MONTHLY" ? `Mensal · dia ${dayOfMonth}` : frequency}
            {categoryName ? ` · ${categoryName}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-md">
          {currentStatus === "PAUSED" ? <Tag variant="neutral">Pausada</Tag> : null}
          {currentStatus === "ENDED" ? <Tag variant="neutral">Encerrada</Tag> : null}
          <span className="tabular-money text-row text-text">{formatBRL(amountCents)}/mês</span>
          {currentStatus === "ACTIVE" ? (
            <div className="flex gap-sm">
              {nextOccurrenceDate && !confirmed ? (
                <button
                  type="button"
                  onClick={handleConfirmNow}
                  disabled={busy}
                  className="text-micro text-accent hover:text-text"
                >
                  {`Confirmar agora (${nextDay}/${nextMonth})`}
                </button>
              ) : null}
              <button type="button" onClick={handlePause} disabled={busy} className="text-micro text-dim hover:text-text">
                Pausar
              </button>
              <button type="button" onClick={handleEnd} disabled={busy} className="text-micro text-dim hover:text-text">
                Encerrar
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-micro text-neg">{error}</p> : null}
    </div>
  );
}
