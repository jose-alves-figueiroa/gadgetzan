"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteTransaction } from "@/lib/server/transactions";

export function TransactionActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Excluir este lançamento?")) return;
    setBusy(true);
    await deleteTransaction(id);
    router.push("/transactions");
  }

  return (
    <div className="flex gap-md">
      <Button variant="secondary" onClick={handleDelete} disabled={busy}>
        Excluir
      </Button>
    </div>
  );
}
