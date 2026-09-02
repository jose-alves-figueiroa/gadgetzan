import { prisma } from "@/lib/db";

export interface NameMaps {
  categories: Map<string, string>;
  accounts: Map<string, string>;
  accountOpeningDate: Map<string, string>;
  cards: Map<string, string>;
  investments: Map<string, string>;
  goals: Map<string, string>;
}

/** Loads every name → id lookup the importer needs, once per validation/commit run. Names are never auto-created. */
export async function loadNameMaps(userId: string): Promise<NameMaps> {
  const [categories, accounts, cards, investments, goals] = await Promise.all([
    prisma.category.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true } }),
    prisma.account.findMany({ where: { userId, archivedAt: null }, select: { id: true, nickname: true, openingDate: true } }),
    prisma.card.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true } }),
    prisma.investment.findMany({ where: { userId, archivedAt: null }, select: { id: true, name: true } }),
    prisma.goal.findMany({ where: { userId, closedAt: null }, select: { id: true, name: true } }),
  ]);

  return {
    categories: new Map(categories.map((c) => [c.name, c.id])),
    accounts: new Map(accounts.map((a) => [a.nickname, a.id])),
    accountOpeningDate: new Map(accounts.map((a) => [a.id, a.openingDate.toISOString().slice(0, 10)])),
    cards: new Map(cards.map((c) => [c.name, c.id])),
    investments: new Map(investments.map((i) => [i.name, i.id])),
    goals: new Map(goals.map((g) => [g.name, g.id])),
  };
}
