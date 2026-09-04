"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { unpayInvoice } from "@/lib/server/invoice-operations";

export function UnpayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        "Desfazer o pagamento desta fatura? Ela volta a aparecer como em aberto. Se foi paga transferindo de outra conta, essa transferência também será desfeita."
      )
    )
      return;
    setBusy(true);
    await unpayInvoice(invoiceId);
    router.refresh();
    setBusy(false);
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={busy}>
      Desfazer pagamento
    </Button>
  );
}
