import { prisma } from "@/lib/db";

export async function listImportBatches(userId: string) {
  return prisma.importBatch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getImportBatch(userId: string, batchId: string) {
  return prisma.importBatch.findFirst({
    where: { id: batchId, userId },
    include: {
      transactions: {
        include: { category: true, account: true, toAccount: true, card: true, investment: true, goal: true },
        orderBy: { competenceDate: "asc" },
      },
    },
  });
}
