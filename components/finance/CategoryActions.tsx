"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { updateCategory, archiveCategory } from "@/lib/server/categories";
import { resolveIcon } from "@/lib/icons";

const NATURE_OPTIONS = [
  { value: "FIXED", label: "Fixa" },
  { value: "VARIABLE", label: "Variável" },
  { value: "COMMITMENT", label: "Compromisso" },
  { value: "INCOME", label: "Receita" },
] as const;

interface CategoryActionsProps {
  id: string;
  name: string;
  nature: (typeof NATURE_OPTIONS)[number]["value"];
  icon: string;
}

export function CategoryActions({ id, name, nature: initialNature, icon }: CategoryActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nature, setNature] = useState(initialNature);
  const [iconName, setIconName] = useState(icon);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const IconPreview = resolveIcon(iconName);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const formData = new FormData(event.currentTarget);
    try {
      await updateCategory(id, {
        name: String(formData.get("name") ?? ""),
        nature,
        icon: iconName,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Excluir esta categoria? Ela deixa de aparecer nas listas, mas o histórico é preservado.")) return;
    setBusy(true);
    await archiveCategory(id);
    router.refresh();
  }

  return (
    <div className="flex gap-sm">
      <Button variant="ghost" className="px-sm py-xs text-micro" onClick={() => setOpen(true)}>
        Editar
      </Button>
      <Button variant="ghost" className="px-sm py-xs text-micro" onClick={handleArchive} disabled={busy}>
        Excluir
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Editar categoria">
        <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
          <Field name="name" label="Nome" defaultValue={name} required />
          <div className="flex flex-col gap-xs">
            <span className="text-micro text-text/70">Natureza</span>
            <Segmented
              options={NATURE_OPTIONS as unknown as { value: string; label: string }[]}
              value={nature}
              onChange={(v) => setNature(v as typeof nature)}
            />
          </div>
          <div className="flex items-end gap-md">
            <Field
              name="icon"
              label="Ícone (Phosphor)"
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              className="flex-1"
            />
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-text">
              <IconPreview />
            </div>
          </div>
          {error ? <p className="text-micro text-neg">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
