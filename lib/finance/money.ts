// Money is always integer centavos. Parsing/formatting happens here, at the
// boundary — never do monetary math in Float. See CLAUDE.md § Money.

/**
 * Parses a pt-BR formatted amount ("1.234,56" or "1234,56") into integer
 * centavos. Throws on empty or non-numeric input.
 */
export function toCents(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Valor obrigatório.");
  }

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);

  if (Number.isNaN(value)) {
    throw new Error(`Valor inválido: ${input}`);
  }

  return Math.round(value * 100);
}

/**
 * Formats integer centavos as a pt-BR currency string. `compact` omits
 * cents when the value is a whole number of reais (KPI usage); tables and
 * forms should leave it off to always show cents.
 */
export function formatBRL(cents: number, options: { compact?: boolean } = {}): string {
  // Normalize -0 (e.g. from negating a zero total) so it never renders "-R$ 0".
  const value = (cents === 0 ? 0 : cents) / 100;
  const isWhole = Number.isInteger(value);
  const showCents = !(options.compact && isWhole);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

/**
 * Integer centavos as a bare pt-BR decimal string ("1234,56", no "R$"
 * prefix) — the inverse of toCents, for pre-filling an editable amount
 * input (a `Field`'s `defaultValue`/`value`) from a stored value.
 */
export function centsToDecimalString(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
