import Link from "next/link";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { listImportBatches } from "@/lib/server/imports/queries";
import { requireUserId } from "@/lib/server/session";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "@/components/ui/Tag";

export default async function ImportsPage() {
  const userId = await requireUserId();
  const batches = await listImportBatches(userId);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-title text-text">Importações</h1>
        <Link
          href="/imports/new"
          className="inline-flex items-center justify-center gap-sm rounded-md border border-accent px-lg py-md text-row font-medium text-accent transition-colors hover:bg-accent/12"
        >
          Nova importação
        </Link>
      </div>

      {batches.length === 0 ? (
        <EmptyState
          icon={UploadSimple}
          title="Nenhuma importação ainda"
          description="Importe seu histórico financeiro a partir de arquivos CSV — veja docs/import-runbook.md para o formato."
        />
      ) : (
        <div className="flex flex-col gap-md">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/imports/${batch.id}`}>
              <Card className="flex-row items-center justify-between hover:bg-text/4">
                <div className="flex flex-col gap-xs">
                  <span className="text-row font-medium text-text">{batch.label}</span>
                  <span className="text-micro text-dim">
                    {batch.createdAt.toISOString().slice(0, 10)} · {batch.createdCount} de {batch.rowCount} linhas
                  </span>
                </div>
                <Tag variant={batch.status === "UNDONE" ? "neutral" : "confirmado"}>
                  {batch.status === "UNDONE" ? "Desfeito" : "Confirmado"}
                </Tag>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
