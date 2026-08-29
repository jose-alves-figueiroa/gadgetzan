"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { recordSimulatedPurchase, type SimulateData } from "@/lib/server/simulate";

export function RecordSimulatedPurchaseButton({ data }: { data: SimulateData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSaving(true);
    setError(null);
    try {
      await recordSimulatedPurchase(data);
      router.push("/transactions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar compra.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-xs">
      <Button onClick={handleClick} disabled={saving}>
        {saving ? "Registrando…" : "Registrar a compra real"}
      </Button>
      {error ? <p className="text-micro text-neg">{error}</p> : null}
    </div>
  );
}
