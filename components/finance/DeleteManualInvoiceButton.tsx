"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteManualInvoice } from "@/lib/server/invoice-operations";

/** Erases a manually-entered invoice with no transactions and no payment —
 * for when the total or the month itself was wrong, not just the value. */
export function DeleteManualInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirm("Apagar esta fatura lançada manualmente? Essa ação não pode ser desfeita.")) return;
    setBusy(true);
    try {
      await deleteManualInvoice(invoiceId);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao apagar fatura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={busy}>
      Apagar fatura
    </Button>
  );
}
