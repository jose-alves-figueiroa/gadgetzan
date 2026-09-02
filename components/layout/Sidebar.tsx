"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flask, GearSix, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { navGroups } from "./nav";

interface SidebarProps {
  onSimulate: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function Sidebar({ onSimulate, drawerOpen, onCloseDrawer }: SidebarProps) {
  const pathname = usePathname();

  const content = (
    <>
      <div className="flex items-center gap-sm px-xl py-xl">
        <span className="h-[18px] w-[18px] rounded-sm bg-accent" />
        <span className="text-row font-medium text-text">Gadgetzan</span>
      </div>

      <nav className="flex flex-1 flex-col gap-xl overflow-y-auto px-md">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-xs">
            <span className="px-md text-navhead uppercase text-neutral-700">
              {group.label}
            </span>
            {group.items.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseDrawer}
                  className={cn(
                    "flex items-center gap-sm rounded-md px-md py-sm text-row transition-colors max-md:min-h-11",
                    active
                      ? "bg-accent/14 text-accent-300 shadow-[inset_0_0_0_1px_rgba(145,132,217,.35)]"
                      : "text-muted hover:text-text"
                  )}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-sm border-t border-line px-md py-lg">
        <button
          type="button"
          onClick={() => {
            onSimulate();
            onCloseDrawer();
          }}
          className="flex items-center justify-center gap-sm rounded-md border border-accent px-md py-sm text-row text-accent transition-colors max-md:min-h-11 hover:bg-accent/12"
        >
          <Flask size={15} />
          Simular compra
        </button>
        <Link
          href="/imports"
          onClick={onCloseDrawer}
          className="flex items-center gap-sm rounded-md px-md py-sm text-row text-muted transition-colors max-md:min-h-11 hover:text-text"
        >
          <UploadSimple size={15} />
          Importações
        </Link>
        <Link
          href="/settings"
          onClick={onCloseDrawer}
          className="flex items-center gap-sm rounded-md px-md py-sm text-row text-muted transition-colors max-md:min-h-11 hover:text-text"
        >
          <GearSix size={15} />
          Ajustes
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: static sidebar, always visible */}
      <aside className="hidden w-[212px] shrink-0 flex-col border-r border-line bg-bg lg:flex">
        {content}
      </aside>

      {/* Below 1024px: drawer overlay. Full responsive polish is Stage 7 (E7-S3). */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/50" onClick={onCloseDrawer} />
          <aside className="relative flex w-[212px] flex-col border-r border-line bg-bg">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
