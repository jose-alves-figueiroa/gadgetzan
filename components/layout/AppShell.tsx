"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileActionBar } from "./MobileActionBar";
import { NewTransactionModal } from "@/components/finance/NewTransactionModal";
import { setHideAmounts } from "@/lib/server/settings";

interface Option {
  id: string;
  name: string;
}

interface CardOption extends Option {
  closingDay: number;
  dueDay: number;
}

interface CategoryOption extends Option {
  nature: "FIXED" | "VARIABLE" | "COMMITMENT" | "INCOME";
}

interface AppShellProps {
  children: ReactNode;
  accounts: Option[];
  cards: CardOption[];
  categories: CategoryOption[];
  investments: Option[];
  hideAmounts: boolean;
}

export function AppShell({
  children,
  accounts,
  cards,
  categories,
  investments,
  hideAmounts: initialHideAmounts,
}: AppShellProps) {
  const router = useRouter();
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hideAmounts, setHideAmountsState] = useState(initialHideAmounts);

  // Keeps the eye-icon toggle in sync when the value changes elsewhere (e.g. the
  // full Settings form), which reaches this layout via revalidatePath, not props.
  useEffect(() => setHideAmountsState(initialHideAmounts), [initialHideAmounts]);

  async function handleToggleHideAmounts() {
    const next = !hideAmounts;
    setHideAmountsState(next);
    try {
      await setHideAmounts({ hideAmounts: next });
    } catch {
      setHideAmountsState(!next);
    }
  }

  return (
    <div className="flex min-h-screen" data-hide-amounts={hideAmounts}>
      <Sidebar
        onSimulate={() => router.push("/simulate")}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onNewTransaction={() => setNewTransactionOpen(true)}
          onOpenDrawer={() => setDrawerOpen(true)}
          hideAmounts={hideAmounts}
          onToggleHideAmounts={handleToggleHideAmounts}
        />
        <main className="flex-1 overflow-y-auto p-2xl pb-[calc(var(--spacing-2xl)+56px)] md:pb-2xl">{children}</main>
      </div>

      <MobileActionBar onNewTransaction={() => setNewTransactionOpen(true)} onSimulate={() => router.push("/simulate")} />

      <NewTransactionModal
        open={newTransactionOpen}
        onClose={() => setNewTransactionOpen(false)}
        categories={categories}
        accounts={accounts}
        cards={cards}
        investments={investments}
      />
    </div>
  );
}
