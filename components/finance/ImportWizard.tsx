"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { validateImport, confirmImport } from "@/lib/server/imports/actions";

type ValidationReport = Awaited<ReturnType<typeof validateImport>>;

const FILE_KINDS = [
  { key: "despesas", label: "Despesas" },
  { key: "receitas", label: "Receitas" },
  { key: "transferencias", label: "Transferências" },
  { key: "investimentos", label: "Investimentos" },
  { key: "porquinhos", label: "Porquinhos" },
  { key: "faturas", label: "Faturas (pagamento/ajuste)" },
] as const;

export function ImportWizard() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [files, setFiles] = useState<Record<string, string>>({});
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFileChange(key: string, fileList: FileList | null) {
    const file = fileList?.[0];
    setReport(null);
    if (!file) {
      setFiles((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const text = await file.text();
    setFiles((prev) => ({ ...prev, [key]: text }));
  }

  async function handleValidate() {
    setError(null);
    setBusy(true);
    try {
      setReport(await validateImport(files));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao validar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      const result = await confirmImport(files, label.trim() || "Importação");
      router.push(`/imports/${result.batchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao confirmar.");
    } finally {
      setBusy(false);
    }
  }

  const canConfirm = Boolean(report) && report!.totals.errors === 0 && report!.accountErrors.length === 0 && report!.totals.ok > 0;

  return (
    <div className="flex flex-col gap-lg">
      <Field name="label" label="Nome do lote" placeholder="Ex.: Nubank cartão 2023-2024" value={label} onChange={(e) => setLabel(e.target.value)} />

      <Card className="gap-md">
        <span className="text-micro text-text/70">
          Envie um ou mais arquivos CSV (`;` como separador) — pelo menos um é obrigatório. Formato de cada um em{" "}
          <code className="text-accent">docs/import-runbook.md</code>.
        </span>
        {FILE_KINDS.map(({ key, label: fileLabel }) => (
          <div key={key} className="flex flex-col gap-xs">
            <label className="text-micro text-text/70">{fileLabel}</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFileChange(key, e.target.files)}
              className="text-micro text-text file:mr-md file:rounded-md file:border file:border-line file:bg-transparent file:px-md file:py-xs file:text-micro file:text-text"
            />
            {files[key] ? <span className="text-micro text-dim">Arquivo carregado.</span> : null}
          </div>
        ))}
      </Card>

      {error ? <p className="text-micro text-neg">{error}</p> : null}

      <div className="flex gap-md">
        <Button variant="secondary" onClick={handleValidate} disabled={busy || Object.keys(files).length === 0}>
          {busy ? "Validando…" : "Validar"}
        </Button>
        {report ? (
          <Button onClick={handleConfirm} disabled={busy || !canConfirm}>
            {busy ? "Confirmando…" : "Confirmar importação"}
          </Button>
        ) : null}
      </div>

      {report ? <ValidationReportView report={report} /> : null}
    </div>
  );
}

function ValidationReportView({ report }: { report: ValidationReport }) {
  const problems = report.rows.filter((r) => r.status !== "ok");

  return (
    <Card className="gap-md">
      <div className="flex flex-wrap items-center gap-md text-micro">
        <span className="text-text">{report.totals.total} linhas</span>
        <span className="text-pos">{report.totals.ok} ok</span>
        {report.totals.warnings > 0 ? <span className="text-dim">{report.totals.warnings} avisos (pulados)</span> : null}
        {report.totals.errors > 0 ? <span className="text-neg">{report.totals.errors} erros</span> : null}
      </div>

      {report.accountErrors.length > 0 ? (
        <div className="flex flex-col gap-xs">
          {report.accountErrors.map((msg, i) => (
            <p key={i} className="text-micro text-neg">
              {msg}
            </p>
          ))}
        </div>
      ) : null}

      {problems.length > 0 ? (
        <div className="flex max-h-[420px] flex-col gap-xs overflow-y-auto">
          {problems.map((row, i) => (
            <div key={i} className="flex flex-col gap-xs rounded-md border border-line px-md py-sm text-micro">
              <div className="flex items-center justify-between gap-md">
                <span className="text-text">
                  {row.file} · linha {row.line} · {row.summary}
                </span>
                <Tag variant="neutral">{row.status === "error" ? "erro" : "aviso"}</Tag>
              </div>
              {row.messages.map((m, j) => (
                <span key={j} className="text-dim">
                  {m}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-micro text-dim">Nenhum problema encontrado.</p>
      )}
    </Card>
  );
}
