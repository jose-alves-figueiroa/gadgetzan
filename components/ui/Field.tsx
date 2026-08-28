import { type InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, id, className, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="text-micro text-text/70">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent",
          className
        )}
        {...props}
      />
      {hint ? <span className="text-micro text-dim">{hint}</span> : null}
    </div>
  );
});
