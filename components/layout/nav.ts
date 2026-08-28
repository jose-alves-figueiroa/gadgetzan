import type { Icon } from "@phosphor-icons/react";
import {
  SquaresFour,
  CalendarCheck,
  ListDashes,
  Bank,
  CreditCard,
  ChartLineUp,
  PiggyBank,
  CalendarDots,
  CalendarBlank,
  ArrowsClockwise,
  Gauge,
  ChartPieSlice,
} from "@phosphor-icons/react/dist/ssr";

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Hoje",
    items: [
      { label: "Dashboard", href: "/", icon: SquaresFour },
      { label: "Mês", href: "/month", icon: CalendarCheck },
      { label: "Lançamentos", href: "/transactions", icon: ListDashes },
      { label: "Contas", href: "/accounts", icon: Bank },
      { label: "Cartões", href: "/cards", icon: CreditCard },
      { label: "Investimentos", href: "/investments", icon: ChartLineUp },
      { label: "Porquinhos", href: "/goals", icon: PiggyBank },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { label: "Próximos meses", href: "/future", icon: CalendarDots },
      { label: "Calendário", href: "/calendar", icon: CalendarBlank },
      { label: "Recorrências", href: "/recurrences", icon: ArrowsClockwise },
      { label: "Limites", href: "/limits", icon: Gauge },
      { label: "Análise", href: "/analysis", icon: ChartPieSlice },
    ],
  },
];
