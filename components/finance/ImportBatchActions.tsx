"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { undoImport } from "@/lib/server/imports/actions";

export function ImportBatchActions({ batchId, undone }: { batchId: string; undone: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUndo() {
    if (!confirm("Desfazer esta importação? Todos os lançamentos criados por ela serão apagados.")) return;
    setBusy(true);
    setError(null);
    try {
      await undoImport(batchId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desfazer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-xs">
      <div className="flex gap-md">
        <a
          href={`/imports/${batchId}/export`}
          className="inline-flex items-center justify-center gap-sm rounded-md border border-line px-lg py-md text-row font-medium text-text transition-colors hover:bg-text/7"
        >
          Baixar CSV
        </a>
        {!undone ? (
          <Button variant="secondary" onClick={handleUndo} disabled={busy}>
            {busy ? "Desfazendo…" : "Desfazer"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-micro text-neg">{error}</p> : null}
    </div>
  );
}
