"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { dismissAlert } from "@/lib/server/alerts";

export function DismissAlertButton({ alertKey }: { alertKey: string }) {
  const [dismissing, setDismissing] = useState(false);

  async function handleClick() {
    setDismissing(true);
    await dismissAlert(alertKey);
  }

  return (
    <Button variant="ghost" onClick={handleClick} disabled={dismissing}>
      Dispensar
    </Button>
  );
}
