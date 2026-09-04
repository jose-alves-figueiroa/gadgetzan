"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { todayDateString } from "@/lib/today";

interface Option {
  id: string;
  name: string;
}
interface CardOption extends Option {
  id: string;
}

export function SimulatorForm({
  categories,
  accounts,
  cards,
}: {
  categories: Option[];
  accounts: Option[];
  cards: CardOption[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"ACCOUNT" | "CARD">("CARD");
  const [installments, setInstallments] = useState(1);
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [date, setDate] = useState(todayDateString());

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({
      description,
      amountCents: amountInput,
      categoryId,
      method,
      installments: String(installments),
      purchaseDate: date,
      ...(method === "CARD" ? { cardId } : { accountId }),
    });
    router.push(`/simulate/result?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-[440px] flex-col gap-lg">
      <div className="inline-flex w-fit items-center gap-xs rounded-sm border border-accent px-md py-xs text-micro text-accent-300">
        Não gera lançamento
      </div>

      <Field label="Descrição" required value={description} onChange={(e) => setDescription(e.target.value)} />
      <Field label="Valor" placeholder="0,00" required value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />

      <div className="flex flex-col gap-xs">
        <label htmlFor="categoryId" className="text-micro text-text/70">
          Categoria
        </label>
        <select
          id="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Segmented
        options={[
          { value: "CARD", label: "Cartão" },
          { value: "ACCOUNT", label: "Débito/Pix" },
        ]}
        value={method}
        onChange={(v) => setMethod(v as typeof method)}
      />

      {method === "CARD" ? (
        <>
          <div className="flex flex-col gap-xs">
            <label htmlFor="cardId" className="text-micro text-text/70">
              Cartão
            </label>
            <select
              id="cardId"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Parcelas"
            type="number"
            min={1}
            max={48}
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
          />
        </>
      ) : (
        <div className="flex flex-col gap-xs">
          <label htmlFor="accountId" className="text-micro text-text/70">
            Conta
          </label>
          <select
            id="accountId"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="min-h-9 rounded-md border border-line bg-surface px-md text-body text-text outline-none focus:border-accent"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <Field label="Quando" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

      <Button type="submit" disabled={!description || !amountInput || (method === "CARD" ? !cardId : !accountId)}>
        Simular impacto
      </Button>
    </form>
  );
}
