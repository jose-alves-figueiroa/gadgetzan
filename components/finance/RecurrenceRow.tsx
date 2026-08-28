"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/finance/money";
import { pauseRecurrenceRule, endRecurrenceRule } from "@/lib/server/recurrences";
import { Tag } from "@/components/ui/Tag";

interface RecurrenceRowProps {
  id: string;
  description: string;
  amountCents: number;
  frequency: string;
  dayOfMonth: number | null;
  categoryName: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
}

export function RecurrenceRow({ id, description, amountCents, frequency, dayOfMonth, categoryName, status }: RecurrenceRowProps) {
  const [busy, setBusy] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

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

  return (
    <div
      className={`flex items-center justify-between rounded-md px-md py-sm ${currentStatus === "PAUSED" ? "opacity-55" : ""}`}
    >
      <div className="flex flex-col gap-xs">
        <span className="text-row text-text">{description}</span>
        <span className="text-micro text-dim">
          {frequency === "MONTHLY" ? `Mensal · dia ${dayOfMonth}` : frequency} · {categoryName}
        </span>
      </div>
      <div className="flex items-center gap-md">
        {currentStatus === "PAUSED" ? <Tag variant="neutral">Pausada</Tag> : null}
        {currentStatus === "ENDED" ? <Tag variant="neutral">Encerrada</Tag> : null}
        <span className="tabular-money text-row text-text">{formatBRL(amountCents)}/mês</span>
        {currentStatus === "ACTIVE" ? (
          <div className="flex gap-sm">
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
  );
}
