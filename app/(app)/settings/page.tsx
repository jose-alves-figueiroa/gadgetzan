import { listCategories } from "@/lib/server/categories";
import { Tag } from "@/components/ui/Tag";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { CreateCategoryModal } from "@/components/finance/CreateCategoryModal";

const NATURE_LABEL: Record<string, string> = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
  COMMITMENT: "Compromisso",
  INCOME: "Receita",
};

export default async function SettingsPage() {
  const categories = await listCategories();

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Ajustes</h1>
        <CreateCategoryModal />
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Nome</TableHeaderCell>
            <TableHeaderCell>Natureza</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="text-text">{category.name}</TableCell>
              <TableCell>
                <Tag variant="neutral">{NATURE_LABEL[category.nature]}</Tag>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
