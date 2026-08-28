import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "border border-accent text-accent bg-transparent hover:bg-accent/12 active:bg-accent/22",
  secondary: "border border-line text-text bg-transparent hover:bg-text/7",
  ghost: "border-transparent text-accent bg-transparent hover:bg-accent/12",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-sm rounded-md px-lg py-md text-row font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
});
