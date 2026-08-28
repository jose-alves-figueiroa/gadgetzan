"use client";

import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: "form" | "wide";
}

export function Modal({ open, onClose, title, children, width = "form" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-lg"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "flex max-h-[85vh] flex-col gap-lg overflow-y-auto rounded-lg bg-surface p-2xl shadow-[0_0_0_1px_#595d6c,0_16px_40px_rgba(0,0,0,.65)]",
          width === "form" ? "w-[440px]" : "w-[880px]"
        )}
      >
        <h2 className="text-title text-text">{title}</h2>
        {children}
      </div>
    </div>
  );
}
