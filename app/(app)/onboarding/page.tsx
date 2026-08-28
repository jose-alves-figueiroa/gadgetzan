import { ensureDefaultCategories, listCategories } from "@/lib/server/categories";
import { OnboardingWizard } from "@/components/finance/OnboardingWizard";

export default async function OnboardingPage() {
  await ensureDefaultCategories();
  const categories = await listCategories();

  return (
    <div className="flex flex-1 items-center justify-center">
      <OnboardingWizard categories={categories.map((c) => ({ id: c.id, name: c.name, nature: c.nature }))} />
    </div>
  );
}
