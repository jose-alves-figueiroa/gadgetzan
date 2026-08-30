/**
 * Low-information projection note — mockup `1ab` / R8. Used wherever a future
 * month has fewer than `Settings.variableLookback` closed months of history:
 * only recurrences and installments are projected yet, variable spend isn't.
 */
export function LowConfidence({ className }: { className?: string }) {
  return (
    <p className={`text-micro text-dim ${className ?? ""}`}>
      Sem histórico suficiente para projetar despesas variáveis — por enquanto, apenas recorrências e parcelas entram
      na projeção.
    </p>
  );
}
