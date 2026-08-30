import { type Icon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: Icon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Empty / first-access state — mockup `1ab`. Icon, sentence, action; never a bare "no data" line. */
export function EmptyState({ icon: IconComponent, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-md rounded-md border border-dashed border-line px-2xl py-2xl text-center",
        className
      )}
    >
      <IconComponent size={26} className="text-dim" />
      <div className="flex flex-col gap-xs">
        <p className="text-row text-text">{title}</p>
        {description ? <p className="text-micro text-dim">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
