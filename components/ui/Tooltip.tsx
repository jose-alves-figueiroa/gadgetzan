"use client";

import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  label: string;
  children: ReactNode;
}

const WIDTH = 240;

export function Tooltip({ label, children }: TooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  function show() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - WIDTH / 2, 8), window.innerWidth - WIDTH - 8);
    setPos({ top: rect.top - 8, left });
  }

  return (
    <span
      ref={anchorRef}
      className="relative inline-flex cursor-help border-b border-dotted border-neutral-700"
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
      tabIndex={0}
    >
      {label}
      {pos
        ? createPortal(
            <span
              style={{ position: "fixed", top: pos.top, left: pos.left, width: WIDTH, transform: "translateY(-100%)" }}
              className="z-[100] rounded-sm bg-tile p-md text-micro text-text shadow-[0_0_0_1px_var(--color-line)]"
            >
              {children}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
