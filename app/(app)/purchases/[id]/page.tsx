import Link from "next/link";
import { notFound } from "next/navigation";
import { getPurchase } from "@/lib/server/purchases";
import { listAccounts } from "@/lib/server/accounts";
import { todayDateString } from "@/lib/server/clock";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { Tag } from "@/components/ui/Tag";
import { PayPurchaseRemainingModal } from "@/components/finance/PayPurchaseRemainingModal";

const VISIBLE_INSTALLMENTS = 6;

export default async function PurchaseDetailPage({ params }: PageProps<"/purchases/[id]">) {
  const { id } = await params;
  const purchase = await getPurchase(id);
  if (!purchase) notFound();

  const today = todayDateString();
  const paidCount = purchase.transactions.filter((t) => t.invoice?.paidAt).length;
  const remainingCents = purchase.transactions
    .filter((t) => !t.invoice?.paidAt)
    .reduce((s, t) => s + t.amountCents, 0);
  const accounts = remainingCents > 0 ? await listAccounts() : [];

  const rows = purchase.transactions.map((t) => {
    const status: "paga" | "na fatura" | "futura" = t.invoice?.paidAt
      ? "paga"
      : t.invoice && t.invoice.closingDate.toISOString().slice(0, 10) <= today
        ? "na fatura"
        : "futura";
    return { ...t, status };
  });

  const visible = rows.slice(0, VISIBLE_INSTALLMENTS);
  const hidden = rows.slice(VISIBLE_INSTALLMENTS);

  return (
    <div className="flex max-w-[420px] flex-col gap-lg">
      <Link href={`/cards/${purchase.cardId}`} className="text-micro text-dim hover:text-text">
        ‹ {purchase.card.name}
      </Link>

      <div className="flex flex-col gap-xs">
        <h1 className="text-title text-text">{purchase.description}</h1>
        <span className="tabular-money text-kpi-lg text-text">{formatBRL(purchase.totalCents)}</span>
        <span className="text-micro text-dim">
          {purchase.installments}× de {formatBRL(Math.round(purchase.totalCents / purchase.installments))} ·{" "}
          {purchase.category.name}
        </span>
      </div>

      <Card className="gap-sm">
        <div className="flex items-center justify-between text-micro">
          <span className="text-dim">
            {paidCount} de {purchase.installments} paga{paidCount === 1 ? "" : "s"}
          </span>
          <span className="text-muted">{Math.round((paidCount / purchase.installments) * 100)}%</span>
        </div>
        <Bar percent={(paidCount / purchase.installments) * 100} />
      </Card>

      {remainingCents > 0 ? (
        <PayPurchaseRemainingModal purchaseId={purchase.id} remainingCents={remainingCents} accounts={accounts} />
      ) : null}

      <Card className="gap-xs">
        {visible.map((t) => (
          <InstallmentRow key={t.id} no={t.installmentNo ?? 0} amountCents={t.amountCents} status={t.status} txId={t.id} />
        ))}
        {hidden.length > 0 ? (
          <div className="flex items-center justify-between px-md py-sm text-micro text-dim">
            <span>+ {hidden.length} parcelas futuras</span>
            <span className="tabular-money">{formatBRL(hidden.reduce((s, t) => s + t.amountCents, 0))}</span>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function InstallmentRow({
  no,
  amountCents,
  status,
  txId,
}: {
  no: number;
  amountCents: number;
  status: "paga" | "na fatura" | "futura";
  txId: string;
}) {
  const variant = status === "paga" ? "realizado" : status === "na fatura" ? "confirmado" : "projetado";
  return (
    <Link
      href={`/transactions/${txId}`}
      className="flex items-center justify-between rounded-md px-md py-sm text-row hover:bg-text/4"
    >
      <span className="text-text">Parcela {no}</span>
      <div className="flex items-center gap-md">
        <span className="tabular-money text-muted">{formatBRL(amountCents)}</span>
        <Tag variant={variant}>{status}</Tag>
      </div>
    </Link>
  );
}
