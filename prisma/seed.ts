import { prisma } from "../lib/db";
import { DEFAULT_CATEGORIES } from "../lib/server/default-categories";

async function main() {
  const user = await prisma.user.findFirst();

  if (!user) {
    console.log(
      "Nenhum usuário encontrado. Rode `pnpm create-user` antes de semear as categorias padrão."
    );
    return;
  }

  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name: category.name },
    });
    if (existing) continue;

    await prisma.category.create({
      data: { ...category, userId: user.id },
    });
  }

  console.log(`Categorias padrão semeadas para ${user.email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
