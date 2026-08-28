import type { CategoryNature } from "@prisma/client";

/** Suggested during onboarding and by `pnpm db:seed` — docs/agents/01-data-model.md. */
export const DEFAULT_CATEGORIES: { name: string; nature: CategoryNature; icon: string }[] = [
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
