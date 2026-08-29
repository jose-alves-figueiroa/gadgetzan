import { listCategories } from "@/lib/server/categories";
import { listAccounts } from "@/lib/server/accounts";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/server/session";
import { SimulatorForm } from "@/components/finance/SimulatorForm";

export default async function SimulatePage() {
  const userId = await requireUserId();
  const [categories, accounts, cards] = await Promise.all([
    listCategories(),
    listAccounts(),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
  ]);

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="text-title text-text">Simular compra</h1>
      <SimulatorForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        accounts={accounts.map((a) => ({ id: a.id, name: a.nickname }))}
        cards={cards.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
