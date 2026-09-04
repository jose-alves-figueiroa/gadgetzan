"use client";

import { type ComponentProps, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { TableRow } from "./Table";

/** A read-only transactions table (card invoice, account/goal detail) whose
 * rows should open the transaction's own page — real `<a>` can't wrap a
 * `<tr>`, so navigation is wired directly on the row instead. */
export function ClickableTableRow({
  href,
  className,
  ...props
}: { href: string } & ComponentProps<typeof TableRow>) {
  const router = useRouter();

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    router.push(href);
  }

  return (
    <TableRow
      {...props}
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={handleKeyDown}
      className={cn("cursor-pointer", className)}
    />
  );
}
