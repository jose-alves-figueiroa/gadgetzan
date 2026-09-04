"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { CaretLeft, CaretRight, Eye, EyeSlash, List, MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface TopbarProps {
  onNewTransaction: () => void;
  onOpenDrawer: () => void;
  hideAmounts: boolean;
  onToggleHideAmounts: () => void;
}

export function Topbar({ onNewTransaction, onOpenDrawer, hideAmounts, onToggleHideAmounts }: TopbarProps) {
  const [monthOffset, setMonthOffset] = useState(0);
  const now = new Date();
  now.setMonth(now.getMonth() + monthOffset);
  const label = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-2xl">
      <div className="flex items-center gap-lg">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={onOpenDrawer}
          className="flex h-8 w-8 items-center justify-center rounded-md text-dim hover:text-text max-md:min-h-11 max-md:min-w-11 lg:hidden"
        >
          <List size={18} />
        </button>
        <div className="flex items-center gap-sm rounded-md border border-line px-md py-xs text-row text-text">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => setMonthOffset((value) => value - 1)}
          className="text-dim hover:text-text"
        >
          <CaretLeft size={14} />
        </button>
        <span className="tabular-nums-mono">{label}</span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => setMonthOffset((value) => value + 1)}
          className="text-dim hover:text-text"
        >
          <CaretRight size={14} />
        </button>
        </div>
      </div>

      <div className="flex items-center gap-lg">
        <button
          type="button"
          aria-label="Ocultar valores"
          aria-pressed={hideAmounts}
          onClick={onToggleHideAmounts}
          className="flex h-8 w-8 items-center justify-center rounded-md text-dim hover:text-text max-md:min-h-11 max-md:min-w-11"
        >
          {hideAmounts ? <EyeSlash size={17} /> : <Eye size={17} />}
        </button>
        <button
          type="button"
          aria-label="Buscar"
          className="flex h-8 w-8 items-center justify-center rounded-md text-dim hover:text-text max-md:min-h-11 max-md:min-w-11"
        >
          <MagnifyingGlass size={17} />
        </button>
        <button
          type="button"
          onClick={onNewTransaction}
          className="hidden items-center gap-sm rounded-md border border-accent px-md py-sm text-row text-accent transition-colors hover:bg-accent/12 md:flex"
        >
          <Plus size={15} />
          Novo lançamento
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sair"
          className="h-7 w-7 rounded-full bg-accent-700"
        />
      </div>
    </header>
  );
}
