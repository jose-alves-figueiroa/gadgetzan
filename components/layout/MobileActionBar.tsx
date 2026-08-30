"use client";

import { Flask, Plus } from "@phosphor-icons/react/dist/ssr";

interface MobileActionBarProps {
  onNewTransaction: () => void;
  onSimulate: () => void;
}

/**
 * Below 768px, the two screen-agnostic primary actions (03-screens.md's
 * "always reachable" rule) move here instead of crowding the topbar — a
 * fixed 56px bar, both targets ≥ 44px.
 */
export function MobileActionBar({ onNewTransaction, onSimulate }: MobileActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex h-14 border-t border-line bg-bg md:hidden">
      <button
        type="button"
        onClick={onSimulate}
        className="flex min-h-11 flex-1 items-center justify-center gap-sm border-r border-line text-row text-muted"
      >
        <Flask size={16} />
        Simular
      </button>
      <button
        type="button"
        onClick={onNewTransaction}
        className="flex min-h-11 flex-1 items-center justify-center gap-sm text-row text-accent"
      >
        <Plus size={16} />
        Novo lançamento
      </button>
    </div>
  );
}
