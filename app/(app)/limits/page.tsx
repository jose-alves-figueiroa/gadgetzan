import { Gauge } from "@phosphor-icons/react/dist/ssr";
import { listLimitsWithUsage } from "@/lib/server/limits";
import { listCategories } from "@/lib/server/categories";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/server/session";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Bar } from "@/components/ui/Bar";
import { EmptyState } from "@/components/ui/EmptyState";
import { HighlightOnCreate } from "@/components/ui/HighlightOnCreate";
import { CreateLimitModal } from "@/components/finance/CreateLimitModal";

const SEVERITY: Record<string, "accent" | "warn" | "neg"> = { ok: "accent", warning: "warn", exceeded: "neg" };

export default async function LimitsPage() {
  const userId = await requireUserId();
  const [limits, categories, cards] = await Promise.all([
    listLimitsWithUsage(),
    listCategories(),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
  ]);

  const totalLimit = limits.find((l) => l.scope === "TOTAL_MONTH");
  const others = limits.filter((l) => l.scope !== "TOTAL_MONTH");

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Limites</h1>
        <CreateLimitModal categories={categories.map((c) => ({ id: c.id, name: c.name }))} cards={cards.map((c) => ({ id: c.id, name: c.name }))} />
      </div>

      {totalLimit ? (
        <Card className="gap-sm">
          <div className="flex items-center justify-between text-row">
            <span className="text-text">{totalLimit.label}</span>
            <span className="tabular-money text-muted">
              {formatBRL(totalLimit.spentCents)} de {formatBRL(totalLimit.amountCents)}
            </span>
          </div>
          <Bar percent={totalLimit.percent} severity={SEVERITY[totalLimit.status]} className="h-[9px]" />
          <span className="text-micro text-dim">{totalLimit.contextNote}</span>
        </Card>
      ) : null}

      {limits.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Nenhum limite cadastrado ainda"
          description="Crie um limite por categoria, cartão ou total mensal para acompanhar o quanto falta."
        />
      ) : (
        <div className="grid grid-cols-2 gap-md lg:grid-cols-3">
          {others.map((limit) => (
            <HighlightOnCreate key={limit.id} id={limit.id}>
              <Card className="gap-sm">
                <span className="text-row text-text">{limit.label}</span>
                <span className="tabular-money text-micro text-muted">
                  {formatBRL(limit.spentCents)} de {formatBRL(limit.amountCents)}
                </span>
                <Bar percent={limit.percent} severity={SEVERITY[limit.status]} />
                <span className="text-micro text-dim">{limit.contextNote}</span>
              </Card>
            </HighlightOnCreate>
          ))}
        </div>
      )}
    </div>
  );
}
