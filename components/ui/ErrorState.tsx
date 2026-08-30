"use client";

import { WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  onRetry?: () => void;
}

/** Error state — mockup `1ab`: red icon, reassurance that data is safe, retry action. */
export function ErrorState({ title = "Não foi possível carregar esta tela.", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-md rounded-md border border-line bg-surface px-2xl py-2xl text-center">
      <WarningOctagon size={26} className="text-neg" />
      <div className="flex flex-col gap-xs">
        <p className="text-row text-text">{title}</p>
        <p className="text-micro text-dim">Seus dados estão salvos.</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
