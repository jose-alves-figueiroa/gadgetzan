"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { archiveAccount } from "@/lib/server/accounts";

export function AccountActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleArchive() {
    if (!confirm("Excluir esta conta? Ela deixa de aparecer nas listas, mas o histórico é preservado.")) return;
    setBusy(true);
    await archiveAccount(id);
    router.push("/accounts");
  }

  return (
    <div className="flex gap-md">
      <Button variant="secondary" onClick={handleArchive} disabled={busy}>
        Excluir
      </Button>
    </div>
  );
}
