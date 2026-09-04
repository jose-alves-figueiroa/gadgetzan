import Link from "next/link";
import { CreditCard } from "@phosphor-icons/react/dist/ssr";
import { listCards } from "@/lib/server/cards";
import { listAccounts } from "@/lib/server/accounts";
import { formatBRL } from "@/lib/finance/money";
import { calculateAvailableLimit } from "@/lib/finance/invoice";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { EmptyState } from "@/components/ui/EmptyState";
import { HighlightOnCreate } from "@/components/ui/HighlightOnCreate";
import { CreateCardModal } from "@/components/finance/CreateCardModal";
import { requireUserId } from "@/lib/server/session";
import { getUnpaidInvoiceTotalCents } from "@/lib/server/invoices";

export default async function CardsPage() {
  const [cards, accounts] = await Promise.all([listCards(), listAccounts()]);
  const userId = await requireUserId();

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Cartões</h1>
        <CreateCardModal accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname }))} />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão cadastrado ainda"
          description="Cadastre um cartão para acompanhar limite, fatura e utilização."
        />
      ) : (
        <div className="flex flex-col gap-md">
          {await Promise.all(
            cards.map(async (card) => {
              const unpaidInvoiceTotalCents = await getUnpaidInvoiceTotalCents(userId, card.id);
              const { availableCents, utilizationPercent } = calculateAvailableLimit({
                limitCents: card.limitCents,
                unpaidInvoiceTotalCents,
              });

              return (
                <Link key={card.id} href={`/cards/${card.id}`}>
                  <HighlightOnCreate id={card.id}>
                    <Card className="gap-md hover:bg-text/4">
                      <div className="flex items-center justify-between">
                        <span className="text-row font-medium text-text">{card.name}</span>
                        <span className="tabular-money text-row text-dim">
                          {formatBRL(unpaidInvoiceTotalCents)} comprometido · {formatBRL(availableCents)} disponível
                        </span>
                      </div>
                      <Bar
                        percent={utilizationPercent}
                        severity={utilizationPercent >= 100 ? "neg" : utilizationPercent >= 80 ? "warn" : "accent"}
                      />
                    </Card>
                  </HighlightOnCreate>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
