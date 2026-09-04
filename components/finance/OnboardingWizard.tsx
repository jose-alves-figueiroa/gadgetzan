"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { updateMonthStartDay } from "@/lib/server/settings";
import { createAccount } from "@/lib/server/accounts";
import { createRecurrenceRule } from "@/lib/server/recurrences";
import { createCard } from "@/lib/server/cards";
import { todayDateString } from "@/lib/today";

interface CategoryOption {
  id: string;
  name: string;
  nature: string;
}

const STEP_LABELS = ["Início do mês", "Conta", "Salário", "Cartão", "Despesas fixas"];

export function OnboardingWizard({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [monthStartDay, setMonthStartDay] = useState(1);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fixedExpenses, setFixedExpenses] = useState<{ description: string; amountCents: string; dayOfMonth: string }[]>([
    { description: "", amountCents: "", dayOfMonth: "5" },
  ]);

  const incomeCategory = categories.find((c) => c.nature === "INCOME");

  function next() {
    setError(null);
    setStep((s) => s + 1);
  }
  function skip() {
    setError(null);
    setStep((s) => s + 1);
  }
  function finish() {
    router.push("/");
    router.refresh();
  }

  async function handleMonthStartDay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateMonthStartDay({ monthStartDay });
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const account = await createAccount({
        institution: String(formData.get("institution") ?? ""),
        nickname: String(formData.get("nickname") ?? ""),
        type: "CHECKING",
        openingBalance: String(formData.get("openingBalance") ?? "0"),
        openingDate: String(formData.get("openingDate") ?? todayDateString()),
        includeInTotals: true,
      });
      setAccountId(account.id);
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSalary(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accountId || !incomeCategory) {
      skip();
      return;
    }
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await createRecurrenceRule({
        kind: "INCOME",
        description: "Salário",
        amountCents: String(formData.get("amountCents") ?? ""),
        frequency: "MONTHLY",
        dayOfMonth: Number(formData.get("dayOfMonth") ?? 5),
        weekday: null,
        monthOfYear: null,
        categoryId: incomeCategory.id,
        method: "ACCOUNT",
        accountId,
        cardId: null,
        startDate: todayDateString(),
        endDate: null,
      });
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar salário.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accountId) {
      skip();
      return;
    }
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await createCard({
        accountId,
        name: String(formData.get("name") ?? ""),
        limitCents: String(formData.get("limitCents") ?? ""),
        closingDay: Number(formData.get("closingDay") ?? 1),
        dueDay: Number(formData.get("dueDay") ?? 10),
        utilizationTarget: null,
      });
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cartão.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFixedExpenses(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accountId) {
      finish();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fixedCategory = categories.find((c) => c.nature === "FIXED") ?? categories[0];
      for (const expense of fixedExpenses) {
        if (!expense.description || !expense.amountCents) continue;
        await createRecurrenceRule({
          kind: "EXPENSE",
          description: expense.description,
          amountCents: expense.amountCents,
          frequency: "MONTHLY",
          dayOfMonth: Number(expense.dayOfMonth) || 5,
          weekday: null,
          monthOfYear: null,
          categoryId: fixedCategory.id,
          method: "ACCOUNT",
          accountId,
          cardId: null,
          startDate: todayDateString(),
          endDate: null,
        });
      }
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar despesas fixas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[440px] flex-col gap-lg">
      <div className="flex items-center gap-sm text-micro text-dim">
        {STEP_LABELS.map((label, i) => (
          <span key={label} className={i === step ? "text-accent-300" : ""}>
            {label}
            {i < STEP_LABELS.length - 1 ? " · " : ""}
          </span>
        ))}
      </div>

      <Card className="gap-lg">
        {step === 0 && (
          <form onSubmit={handleMonthStartDay} className="flex flex-col gap-lg">
            <h2 className="text-title text-text">Quando começa seu mês financeiro?</h2>
            <Field
              label="Dia do pagamento"
              type="number"
              min={1}
              max={28}
              value={monthStartDay}
              onChange={(e) => setMonthStartDay(Number(e.target.value))}
              required
            />
            {error ? <p className="text-micro text-neg">{error}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Continuar"}
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={handleAccount} className="flex flex-col gap-lg">
            <h2 className="text-title text-text">Sua primeira conta</h2>
            <Field name="institution" label="Instituição" required />
            <Field name="nickname" label="Apelido" required />
            <Field name="openingBalance" label="Saldo atual" placeholder="0,00" required />
            <Field name="openingDate" label="Data" type="date" defaultValue={todayDateString()} required />
            {error ? <p className="text-micro text-neg">{error}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Continuar"}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSalary} className="flex flex-col gap-lg">
            <h2 className="text-title text-text">Seu salário</h2>
            <p className="text-micro text-dim">É isso que faz a projeção existir.</p>
            <Field name="amountCents" label="Valor mensal" placeholder="0,00" required />
            <Field name="dayOfMonth" label="Dia do mês" type="number" min={1} max={31} defaultValue={5} required />
            {error ? <p className="text-micro text-neg">{error}</p> : null}
            <div className="flex gap-md">
              <Button type="button" variant="secondary" onClick={skip}>
                Pular
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Continuar"}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleCard} className="flex flex-col gap-lg">
            <h2 className="text-title text-text">Seu cartão (opcional)</h2>
            <Field name="name" label="Nome" />
            <Field name="limitCents" label="Limite" placeholder="0,00" />
            <div className="flex gap-lg">
              <Field name="closingDay" label="Fechamento" type="number" min={1} max={28} defaultValue={1} />
              <Field name="dueDay" label="Vencimento" type="number" min={1} max={28} defaultValue={10} />
            </div>
            {error ? <p className="text-micro text-neg">{error}</p> : null}
            <div className="flex gap-md">
              <Button type="button" variant="secondary" onClick={skip}>
                Pular
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Continuar"}
              </Button>
            </div>
          </form>
        )}

        {step === 4 && (
          <form onSubmit={handleFixedExpenses} className="flex flex-col gap-lg">
            <h2 className="text-title text-text">Despesas fixas e compromissos</h2>
            {fixedExpenses.map((expense, index) => (
              <div key={index} className="flex gap-sm">
                <input
                  placeholder="Nome"
                  value={expense.description}
                  onChange={(e) => {
                    const copy = [...fixedExpenses];
                    copy[index] = { ...copy[index], description: e.target.value };
                    setFixedExpenses(copy);
                  }}
                  className="min-h-9 flex-1 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
                />
                <input
                  placeholder="0,00"
                  value={expense.amountCents}
                  onChange={(e) => {
                    const copy = [...fixedExpenses];
                    copy[index] = { ...copy[index], amountCents: e.target.value };
                    setFixedExpenses(copy);
                  }}
                  className="min-h-9 w-[100px] rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFixedExpenses([...fixedExpenses, { description: "", amountCents: "", dayOfMonth: "5" }])}
              className="text-micro text-accent-300"
            >
              + Adicionar outra
            </button>
            {error ? <p className="text-micro text-neg">{error}</p> : null}
            <div className="flex gap-md">
              <Button type="button" variant="secondary" onClick={finish}>
                Pular
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Concluir"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
