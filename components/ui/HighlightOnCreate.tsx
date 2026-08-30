"use client";

import { Children, cloneElement, isValidElement, useEffect, useState, type ReactElement } from "react";

const STORAGE_KEY = "gz:last-created";

/** Call right before closing a create modal, with the id the server action returned. */
export function markCreated(id: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // sessionStorage unavailable (e.g. private mode) — silent success just won't highlight.
  }
}

interface HighlightOnCreateProps {
  id: string;
  children: ReactElement<{ className?: string }>;
}

/**
 * Silent success state (`1ab`): wraps a list row so that, if it was the row
 * just created via `markCreated`, it gets a 1.2s accent-background highlight
 * on mount — no toast. Clones the single child so it works whether the row
 * is a `<tr>`, a `<Link>`, or a `Card` div.
 */
export function HighlightOnCreate({ id, children }: HighlightOnCreateProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (stored !== id) return;

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setActive(true);
    const timeout = setTimeout(() => setActive(false), 1200);
    return () => clearTimeout(timeout);
  }, [id]);

  const child = Children.only(children);
  if (!isValidElement(child)) return children;

  const existingClassName = (child.props as { className?: string }).className ?? "";
  return cloneElement(child, {
    className: [existingClassName, active ? "bg-accent/10 transition-colors duration-300" : ""]
      .filter(Boolean)
      .join(" "),
  });
}
