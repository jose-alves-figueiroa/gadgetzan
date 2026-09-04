import Link from "next/link";
import { todayDateString } from "@/lib/today";
import { runSimulation, type SimulateData } from "@/lib/server/simulate";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { RecordSimulatedPurchaseButton } from "@/components/finance/RecordSimulatedPurchaseButton";

export default async function SimulationResultPage({ searchParams }: PageProps<"/simulate/result">) {
  const search = await searchParams;

  const data: SimulateData = {
    description: String(search?.description ?? ""),
    amountCents: String(search?.amountCents ?? ""),
    categoryId: String(search?.categoryId ?? ""),
    method: (search?.method === "ACCOUNT" ? "ACCOUNT" : "CARD") as "ACCOUNT" | "CARD",
    cardId: search?.cardId ? String(search.cardId) : null,
    accountId: search?.accountId ? String(search.accountId) : null,
    installments: Number(search?.installments ?? 1),
    purchaseDate: String(search?.purchaseDate ?? todayDateString()),
  };

  const result = await runSimulation(data);
  const hasConcern = result.warnings.some((w) => w.kind !== "ok");

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Resultado da simulação</h1>
        <Link href="/simulate" className="text-micro text-accent-300 hover:underline">
          Ajustar simulação
        </Link>
      </div>

      <Card className={`gap-sm ${hasConcern ? "shadow-[inset_0_0_0_1px_var(--color-warn)]" : "shadow-[inset_0_0_0_1px_var(--color-pos)]"}`}>
        <span className="text-row text-text">{hasConcern ? "Atenção antes de seguir" : "Compra tranquila"}</span>
        {result.warnings.map((w, i) => (
          <p key={i} className={`text-micro ${w.kind === "ok" ? "text-pos" : "text-warn"}`}>
            {w.message}
          </p>
        ))}
      </Card>

      <div className="grid grid-cols-2 gap-md lg:grid-cols-3">
        {result.invoiceImpact ? (
          <>
            <KpiBeforeAfter label="Fatura atual" before={result.invoiceImpact.currentInvoiceBeforeCents} after={result.invoiceImpact.currentInvoiceAfterCents} />
            <KpiBeforeAfter label="Próxima fatura" before={result.invoiceImpact.nextInvoiceBeforeCents} after={result.invoiceImpact.nextInvoiceAfterCents} />
          </>
        ) : null}
        {result.limitImpact ? (
          <>
            <KpiBeforeAfter label="Limite disponível" before={result.limitImpact.availableBeforeCents} after={result.limitImpact.availableAfterCents} invert />
            <Card className="gap-xs">
              <span className="text-micro text-dim">Utilização do cartão</span>
              <div className="flex items-center gap-xs text-micro text-muted">
                <span>{Math.round(result.limitImpact.utilizationBeforePercent)}%</span>
                <span>→</span>
                <span className="text-text">{Math.round(result.limitImpact.utilizationAfterPercent)}%</span>
              </div>
              <Bar
                percent={result.limitImpact.utilizationAfterPercent}
                severity={result.limitImpact.utilizationAfterPercent >= 100 ? "neg" : result.limitImpact.utilizationAfterPercent >= 80 ? "warn" : "accent"}
              />
            </Card>
          </>
        ) : null}
        <KpiBeforeAfter
          label="Saldo hoje"
          before={result.projectedBalanceBefore[0]}
          after={result.projectedBalanceAfter[0]}
          invert
        />
      </div>

      <Card className="gap-md">
        <span className="text-navhead uppercase text-neutral-700">Saldo projetado — com vs. sem a compra</span>
        <ProjectionChart before={result.projectedBalanceBefore} after={result.projectedBalanceAfter} />
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Mês</TableHeaderCell>
              <TableHeaderCell className="text-right">Sem a compra</TableHeaderCell>
              <TableHeaderCell className="text-right">Com a compra</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {result.projectedBalanceBefore.map((before, i) => (
              <TableRow key={i}>
                <TableCell className="text-muted">{i === 0 ? "Hoje" : `+${i} mês${i > 1 ? "es" : ""}`}</TableCell>
                <TableCell className="tabular-money text-right text-muted">{formatBRL(before, { compact: true })}</TableCell>
                <TableCell className="tabular-money text-right text-text">{formatBRL(result.projectedBalanceAfter[i], { compact: true })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-micro text-dim">Nenhum lançamento foi criado — isto é só uma simulação.</p>

      <div className="flex gap-md">
        <RecordSimulatedPurchaseButton data={data} />
      </div>
    </div>
  );
}

function KpiBeforeAfter({ label, before, after, invert = false }: { label: string; before: number; after: number; invert?: boolean }) {
  const worse = invert ? after < before : after > before;
  return (
    <Card className="gap-xs">
      <span className="text-micro text-dim">{label}</span>
      <div className="flex items-center gap-xs text-micro">
        <span className="tabular-money text-dim line-through">{formatBRL(before, { compact: true })}</span>
        <span className="text-dim">→</span>
        <span className={`tabular-money ${worse ? "text-neg" : "text-text"}`}>{formatBRL(after, { compact: true })}</span>
      </div>
    </Card>
  );
}

function ProjectionChart({ before, after }: { before: number[]; after: number[] }) {
  const width = 560;
  const height = 120;
  const all = [...before, ...after];
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const range = max - min || 1;

  const toPoints = (series: number[]) =>
    series
      .map((v, i) => {
        const x = (i / (series.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full">
      <polyline points={toPoints(before)} fill="none" stroke="var(--color-muted)" strokeWidth={2} />
      <polyline points={toPoints(after)} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 4" />
    </svg>
  );
}
