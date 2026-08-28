import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type TagVariant = "realizado" | "confirmado" | "projetado" | "neutral";

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant;
}

const variantClasses: Record<TagVariant, string> = {
  realizado: "bg-neutral-800 text-text",
  confirmado: "bg-accent-800 text-accent-100",
  projetado: "border border-accent text-accent bg-transparent",
  neutral: "bg-neutral-800 text-muted",
};

export function Tag({ variant = "neutral", className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-md py-xs text-micro",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
