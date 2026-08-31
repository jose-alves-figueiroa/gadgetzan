import type { CategoryNature } from "@prisma/client";

/** Suggested during onboarding and by `pnpm db:seed` — docs/agents/01-data-model.md. */
export const DEFAULT_CATEGORIES: { name: string; nature: CategoryNature; icon: string }[] = [
  { name: "Ajuda familiar", nature: "COMMITMENT", icon: "users-three" },
  { name: "Alimentação", nature: "VARIABLE", icon: "fork-knife" },
  { name: "Assinaturas", nature: "FIXED", icon: "monitor-play" },
  { name: "Bares e Restaurantes", nature: "VARIABLE", icon: "beer-stein" },
  { name: "Combustível", nature: "VARIABLE", icon: "gas-pump" },
  { name: "Compras Online", nature: "VARIABLE", icon: "shopping-cart" },
  { name: "Contas", nature: "FIXED", icon: "receipt" },
  { name: "Cuidados Pessoais", nature: "VARIABLE", icon: "scissors" },
  { name: "Educação", nature: "FIXED", icon: "graduation-cap" },
  { name: "Feira", nature: "VARIABLE", icon: "basket" },
  { name: "Igreja e doações", nature: "COMMITMENT", icon: "hand-heart" },
  { name: "Lazer", nature: "VARIABLE", icon: "confetti" },
  { name: "Moradia", nature: "FIXED", icon: "house" },
  { name: "Outras receitas", nature: "INCOME", icon: "trend-up" },
  { name: "Outros", nature: "VARIABLE", icon: "dots-three-circle" },
  { name: "Salário", nature: "INCOME", icon: "bank" },
  { name: "Saúde", nature: "VARIABLE", icon: "barbell" },
  { name: "Transporte", nature: "VARIABLE", icon: "car" },
  { name: "Viagem", nature: "VARIABLE", icon: "airplane-tilt" },
];
