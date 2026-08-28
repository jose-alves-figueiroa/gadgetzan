import { CategoryNature } from "@prisma/client";
import { prisma } from "../lib/db";

// Default categories suggested during onboarding — docs/agents/01-data-model.md
const DEFAULT_CATEGORIES: { name: string; nature: CategoryNature; icon: string }[] = [
  { name: "Moradia", nature: "FIXED", icon: "house" },
  { name: "Alimentação", nature: "VARIABLE", icon: "fork-knife" },
  { name: "Transporte", nature: "VARIABLE", icon: "car" },
  { name: "Lazer", nature: "VARIABLE", icon: "confetti" },
  { name: "Saúde", nature: "VARIABLE", icon: "barbell" },
  { name: "Educação", nature: "FIXED", icon: "graduation-cap" },
  { name: "Ajuda familiar", nature: "COMMITMENT", icon: "users-three" },
  { name: "Igreja e doações", nature: "COMMITMENT", icon: "hand-heart" },
  { name: "Assinaturas", nature: "FIXED", icon: "monitor-play" },
  { name: "Outros", nature: "VARIABLE", icon: "dots-three-circle" },
  { name: "Salário", nature: "INCOME", icon: "bank" },
  { name: "Outras receitas", nature: "INCOME", icon: "trend-up" },
];

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
