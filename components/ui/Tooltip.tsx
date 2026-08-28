"use client";

import { type ReactNode, useState } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex cursor-help border-b border-dotted border-neutral-700"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {label}
      {open ? (
        <span className="absolute bottom-full left-1/2 z-10 mb-xs w-[240px] -translate-x-1/2 rounded-sm bg-tile p-md text-micro text-text shadow-[0_0_0_1px_var(--color-line)]">
          {children}
        </span>
      ) : null}
    </span>
  );
}
