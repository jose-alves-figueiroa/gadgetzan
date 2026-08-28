import { z } from "zod";
import { toCents } from "@/lib/finance/money";

function parseCents(val: string, ctx: z.RefinementCtx): number {
  try {
    return toCents(val);
  } catch (err) {
    ctx.addIssue({ code: "custom", message: err instanceof Error ? err.message : "Valor inválido." });
    return z.NEVER;
  }
}

/** Amount required and > 0 (05 § Form validations). */
export const centsPositive = z.string().transform(parseCents).pipe(z.number().positive("Valor deve ser maior que zero."));

/** Any value, including 0 or negative (e.g. an account's opening balance). */
export const centsAny = z.string().transform(parseCents);
