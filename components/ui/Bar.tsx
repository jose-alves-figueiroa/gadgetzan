import { cn } from "@/lib/cn";

interface BarProps {
  /** 0–100 */
  percent: number;
  severity?: "accent" | "warn" | "neg";
  className?: string;
}

const severityClasses = {
  accent: "bg-accent",
  warn: "bg-warn",
  neg: "bg-neg",
};

export function Bar({ percent, severity = "accent", className }: BarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-[8px] w-full rounded-sm bg-tile", className)}
    >
      <div
        className={cn("h-full rounded-sm", severityClasses[severity])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
