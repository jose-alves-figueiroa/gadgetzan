import Link from "next/link";
import { getProjectedInvoices } from "@/lib/server/invoice-forecast";
import { formatBRL } from "@/lib/finance/money";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

const STATUS_VARIANT = {
  REALIZADO: "realizado",
  CONFIRMADO: "confirmado",
  PROJETADO: "projetado",
} as const;

export default async function ProjectedInvoicesPage({ params }: PageProps<"/cards/[id]/invoices">) {
  const { id } = await params;
  const { card, rows } = await getProjectedInvoices(id);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center gap-md">
        <Link href={`/cards/${id}`} className="text-dim hover:text-text">
          ‹ {card.name}
        </Link>
      </div>
      <h1 className="text-title text-text">Faturas projetadas</h1>

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Mês</TableHeaderCell>
              <TableHeaderCell className="text-right">Compras</TableHeaderCell>
              <TableHeaderCell className="text-right">Parcelas</TableHeaderCell>
              <TableHeaderCell className="text-right">Assinaturas</TableHeaderCell>
              <TableHeaderCell className="text-right">Total</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.year}-${row.month}`}>
                <TableCell className="capitalize text-text">{row.label}</TableCell>
                <TableCell className="tabular-money text-right text-muted">{formatBRL(row.comprasCents)}</TableCell>
                <TableCell className="tabular-money text-right text-muted">{formatBRL(row.parcelasCents)}</TableCell>
                <TableCell className="tabular-money text-right text-muted">{formatBRL(row.assinaturasCents)}</TableCell>
                <TableCell className="tabular-money text-right text-text">{formatBRL(row.totalCents)}</TableCell>
                <TableCell>
                  <Tag variant={STATUS_VARIANT[row.status]}>{row.status[0] + row.status.slice(1).toLowerCase()}</Tag>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-micro text-dim">
        Compras futuras avulsas não são estimadas — só entram no total quando lançadas (R8).
      </p>
    </div>
  );
}
