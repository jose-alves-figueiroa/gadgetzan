import Link from "next/link";
import { ImportWizard } from "@/components/finance/ImportWizard";

export default function NewImportPage() {
  return (
    <div className="flex max-w-[640px] flex-col gap-lg">
      <Link href="/imports" className="text-micro text-dim hover:text-text">
        ‹ Importações
      </Link>
      <h1 className="text-title text-text">Nova importação</h1>
      <ImportWizard />
    </div>
  );
}
