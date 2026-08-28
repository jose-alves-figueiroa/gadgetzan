import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { listAccounts } from "@/lib/server/accounts";
import { listCards } from "@/lib/server/cards";
import { listCategories } from "@/lib/server/categories";
import { listInvestments } from "@/lib/server/investments";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [accounts, cards, categories, investments] = await Promise.all([
    listAccounts(),
    listCards(),
    listCategories(),
    listInvestments(),
  ]);

  return (
    <AppShell
      accounts={accounts.map((a) => ({ id: a.id, name: a.nickname }))}
      cards={cards.map((c) => ({ id: c.id, name: c.name, closingDay: c.closingDay, dueDay: c.dueDay }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      investments={investments.map((i) => ({ id: i.id, name: i.name }))}
    >
      {children}
    </AppShell>
  );
}
