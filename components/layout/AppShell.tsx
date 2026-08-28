"use client";

import { type ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Modal } from "@/components/ui/Modal";

export function AppShell({ children }: { children: ReactNode }) {
  const [newTransactionOpen, setNewTransactionOpen] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        onSimulate={() => setSimulateOpen(true)}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onNewTransaction={() => setNewTransactionOpen(true)}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-2xl">{children}</main>
      </div>

      <Modal
        open={newTransactionOpen}
        onClose={() => setNewTransactionOpen(false)}
        title="Novo lançamento"
      >
        <p className="text-row text-muted">Em construção — chega no Stage 3.</p>
      </Modal>

      <Modal open={simulateOpen} onClose={() => setSimulateOpen(false)} title="Simular compra">
        <p className="text-row text-muted">Em construção — chega no Stage 6.</p>
      </Modal>
    </div>
  );
}
