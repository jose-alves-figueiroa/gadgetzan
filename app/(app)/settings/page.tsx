import { listCategories } from "@/lib/server/categories";
import { getSettings } from "@/lib/server/settings";
import { resolveIcon } from "@/lib/icons";
import { Tag } from "@/components/ui/Tag";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { HighlightOnCreate } from "@/components/ui/HighlightOnCreate";
import { CreateCategoryModal } from "@/components/finance/CreateCategoryModal";
import { CategoryActions } from "@/components/finance/CategoryActions";
import { SettingsForm } from "@/components/finance/SettingsForm";

const NATURE_LABEL: Record<string, string> = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
  COMMITMENT: "Compromisso",
  INCOME: "Receita",
};

export default async function SettingsPage() {
  const [categories, settings] = await Promise.all([listCategories(), getSettings()]);

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="text-title text-text">Ajustes</h1>

      <SettingsForm
        monthStartDay={settings.monthStartDay}
        projectionMonths={settings.projectionMonths}
        cardUtilizationTarget={settings.cardUtilizationTarget}
        hideAmounts={settings.hideAmounts}
      />

      <div className="flex items-center justify-between">
        <span className="text-navhead uppercase text-neutral-700">Categorias</span>
        <CreateCategoryModal />
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nome</TableHeaderCell>
            <TableHeaderCell>Natureza</TableHeaderCell>
            <TableHeaderCell className="text-right">Ações</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {categories.map((category) => {
            const CategoryIcon = resolveIcon(category.icon);
            return (
              <HighlightOnCreate key={category.id} id={category.id}>
                <TableRow edgeFade={false}>
                  <TableCell className="text-text">
                    <div className="flex items-center gap-sm">
                      <CategoryIcon className="text-dim" />
                      {category.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tag variant="neutral">{NATURE_LABEL[category.nature]}</Tag>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <CategoryActions
                        id={category.id}
                        name={category.name}
                        nature={category.nature}
                        icon={category.icon}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              </HighlightOnCreate>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
