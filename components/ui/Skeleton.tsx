import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A single skeleton block. Shape it (width/height) to match the real content it stands in for. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-line/50", className)}
      {...props}
    />
  );
}

/** Loading state for a KPI row — mockup `1ab`: skeletons shaped like the real content, never a spinner. */
export function SkeletonKpiRow({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-md" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-sm rounded-md bg-surface p-xl">
          <Skeleton className="h-[10.5px] w-2/3" />
          <Skeleton className="h-[29px] w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-sm rounded-md bg-surface p-xl", className)}>
      <Skeleton className="h-[12.5px] w-1/3" />
      <Skeleton className="h-[19px] w-2/3" />
      <Skeleton className="h-[6px] w-full" />
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-xs">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[36px] w-full" />
      ))}
    </div>
  );
}

/** Generic screen skeleton for route-level `loading.tsx` — a KPI row plus a card list, roughly shaped like most screens. */
export function SkeletonScreen() {
  return (
    <div className="flex flex-col gap-lg">
      <Skeleton className="h-[19px] w-40" />
      <SkeletonKpiRow />
      <div className="flex flex-col gap-md">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
