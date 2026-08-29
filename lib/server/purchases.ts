import { prisma } from "@/lib/db";
import { requireUserId } from "./session";

export async function getPurchase(id: string) {
  const userId = await requireUserId();
  const purchase = await prisma.purchase.findFirst({
    where: { id, userId },
    include: {
      card: true,
      category: true,
      transactions: {
        orderBy: { installmentNo: "asc" },
        include: { invoice: true },
      },
    },
  });
  return purchase;
}
