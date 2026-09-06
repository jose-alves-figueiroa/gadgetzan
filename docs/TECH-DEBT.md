# Tech debt — Gadgetzan

Known gaps and shortcuts surfaced or introduced while implementing features, tracked deliberately instead of by surprise. Each entry says why it wasn't fixed inline, so it can be picked up on purpose instead of rediscovered by accident.

For gaps in the *design* itself (missing mockups, undecided flows), see `docs/agents/07-open-decisions.md` § "Known design debts" instead — this file is about implementation shortcuts in already-specified behavior.

Status convention: `[ ]` open · `[~]` partially addressed · `[x]` resolved.

---

## Overview

| # | Item | Status |
| --- | --- | --- |
| 1 | [Installment `competenceDate` doesn't shift per installment](#1-installment-competencedate-doesnt-shift-per-installment) | `[x]` resolved |
| 2 | ["Ocultar valores" has two blind spots](#2-ocultar-valores-has-two-blind-spots) | `[ ]` open |
| 3 | [Topbar month selector doesn't scope every page](#3-topbar-month-selector-doesnt-scope-every-page) | `[ ]` open |
| 4 | ["Desfazer pagamento" only reverses an unambiguous companion Transfer](#4-desfazer-pagamento-only-reverses-an-unambiguous-companion-transfer) | `[ ]` open |
| 5 | [Account editing covers only opening balance/date](#5-account-editing-covers-only-opening-balancedate) | `[ ]` open |
| 6 | [Investment revaluation and per-investment aporte/resgate are minimal](#6-investment-revaluation-and-per-investment-aporteresgate-are-minimal) | `[ ]` open |
| 7 | [`ClickableTableRow` isn't a real link](#7-clickabletablerow-isnt-a-real-link) | `[ ]` open |
| 8 | [Card detail screen never shows how much of the invoice is already paid](#8-card-detail-screen-never-shows-how-much-of-the-invoice-is-already-paid) | `[ ]` open |
| 9 | [No edit path for a card's limit (or any other field) after creation](#9-no-edit-path-for-a-cards-limit-or-any-other-field-after-creation) | `[ ]` open |
| 10 | [Card screens never display closing/due day](#10-card-screens-never-display-closingdue-day) | `[ ]` open |

---

## 1. Installment `competenceDate` doesn't shift per installment

**Status**: `[x]` resolved — see `CHANGELOG.md` entry from 04/09/2026.

**Where**: `createInstallmentPurchaseCore` (`lib/server/transaction-core.ts`); domain logic in `lib/finance/installments.ts`.

`createInstallmentPurchaseCore` used to set every installment's `competenceDate` to the *original purchase date*, not to the month its own invoice bills for. `invoiceId` correctly advanced one month per installment (R4), but `competenceDate` — what `/month`, category limits, and monthly alerts filter on — did not.

Concretely: a 2x purchase made in September, with installment 2 due in November, used to still count installment 2 as a **September** expense in every monthly report; November showed nothing for it.

**Resolution**: the product decision was made — each installment now burdens its own financial month. `docs/agents/02-business-rules.md` R4 item 4 documents the resolved rule: installment 1 keeps the real purchase date, installment N (N > 1) uses that installment's own invoice due date. `InstallmentPlanItem.competenceDate` (`lib/finance/installments.ts`) is the single source every write path (`createInstallmentPurchaseCore`, `createRemainingInstallmentsCore`, `recalculateInstallments`) now reads from, so the fix applies to every screen that aggregates on `competenceDate` — not just `/month`.

**Follow-up**: installments already recorded before this fix keep their old (pre-fix) `competenceDate`. Backfilling them is tracked separately, pending user sign-off — see [`docs/epic/EPICS.md` #1](epic/EPICS.md#1-backfill-competencedate-for-existing-installments).

---

## 2. "Ocultar valores" has two blind spots

**Status**: `[ ]` open.

**Where**: mini bar charts (Análise, Patrimônio, Dashboard); `lib/finance/alerts.ts` and `lib/finance/simulate.ts`.

See `CHANGELOG.md` entries from 03/09/2026 21:10 and 22:56.

- Native `title`-attribute tooltips on mini bar charts (Análise, Patrimônio, Dashboard) show the real value on hover — CSS can't intercept a browser-native tooltip.
- Alert titles (`/alerts`, the dashboard alert card) and simulation warning messages build the monetary value directly into a prose string, in `lib/finance/alerts.ts` / `lib/finance/simulate.ts`. Masking would mean separating the message template from its value in the domain layer — a real refactor, not a CSS tweak.

**Why not fixed**: the first is a browser limitation (no CSS hook to intercept a native tooltip); the second requires splitting message templates from their values in the financial domain layer, which is more than the original "hide amounts" feature scoped for.

---

## 3. Topbar month selector doesn't scope every page

**Status**: `[ ]` open.

**Where**: topbar month selector (`?month=` query param).

The topbar's `‹ month ›` reads/writes a `?month=` param on whatever page is currently open. It correctly drives `/cards/[id]` and `/calendar` (which already used that param before this existed), but on any other page it just accumulates a harmless, invisible `?month=` in the URL with no effect. There's no shared "month context" the rest of the app subscribes to.

**Why not fixed**: introducing a shared month context that every screen subscribes to is a cross-cutting architectural change, not a page-local fix.

---

## 4. "Desfazer pagamento" only reverses an unambiguous companion Transfer

**Status**: `[ ]` open.

**Where**: `findCompanionTransferIds` (`lib/server/transaction-core.ts`).

`findCompanionTransferIds` deletes the Transfer created by "pagar via transferência" only when exactly one candidate matches on account/amount/date/note. Two transfers sharing the same amount, date, destination, and note on the same day won't be touched — whoever hits that edge case has to delete the leftover Transfer by hand.

**Why not fixed**: disambiguating beyond account/amount/date/note would need a stronger link between a payment and its companion transfer (e.g. a stored reference id), which the current data model doesn't carry.

---

## 5. Account editing covers only opening balance/date

**Status**: `[ ]` open.

**Where**: `updateAccountOpeningBalance`.

`updateAccountOpeningBalance` edits `openingBalance`/`openingDate` only. Institution, nickname, type, and `includeInTotals` still have no edit path after creation — set once, never revisited.

**Why not fixed**: out of scope for the story that introduced opening-balance editing (see `CHANGELOG.md`, "allow editing an account's opening balance/date after creation"); extending the same edit path to the remaining fields is a separate, well-scoped follow-up.

---

## 6. Investment revaluation and per-investment aporte/resgate are minimal

**Status**: `[ ]` open.

**Where**: `UpdateInvestmentValueModal`; `/investments` (`docs/agents/03-screens.md` §15).

`UpdateInvestmentValueModal` is the only revaluation path — a flat "set `currentCents`," with no history of past valuations kept. There's also no dedicated "Aportar"/"Resgatar" button per investment on `/investments` (`docs/agents/03-screens.md` §15 describes one); contributions/withdrawals only go through the generic "Novo lançamento" modal today.

**Why not fixed**: a valuation-history table and per-row aporte/resgate actions are a real chunk of new work, not an incremental addition to the existing revaluation flow.

---

## 7. `ClickableTableRow` isn't a real link

**Status**: `[ ]` open.

**Where**: `components/ui/ClickableTableRow.tsx`.

`ClickableTableRow` fakes anchor semantics (`role="link"` + `tabIndex` + `onClick`/`onKeyDown`) since a real `<a>` can't wrap a `<tr>`. Click and keyboard (Enter/Space) work; things a real `<a>` gives you for free — cmd/ctrl-click or middle-click to open in a new tab, "copy link," drag-to-bookmark — don't.

**Why not fixed**: a real fix means restructuring the table markup (or replacing `<tr>` semantics) across every screen that uses `ClickableTableRow`, not a local change to the component itself.

---

## 8. Card detail screen never shows how much of the invoice is already paid

**Status**: `[ ]` open — reported by the user against a real invoice (September 2026 card invoice, partially paid R$ 652,91 of R$ 1.354,00).

**Where**: `app/(app)/cards/[id]/page.tsx`.

`invoiceTotal` (line 55–57) is deliberately the gross sum of `EXPENSE`/`CARD_ADJUSTMENT` charges for the invoice — it already correctly excludes the `CARD_PAYMENT` row, and `outstanding = calculateOutstandingBalance(invoiceTotal, invoice.paidCents)` (line 58) is computed correctly and correctly gates the "Pagar fatura"/"Fatura paga" branch (line 95). So a partial payment *is* recorded and accounted for internally.

The screen just never surfaces that: the only number shown under "Total da fatura" is the gross `invoiceTotal`, with no "Pago" / "Restante" breakdown next to it. The `CARD_PAYMENT` transaction does appear as an ordinary row in the transaction table, but nothing calls out that it already reduced what's owed. After paying R$ 652,91 of a R$ 1.354,00 invoice, the footer still reads "Total da fatura: R$ 1.354,00" with no visible R$ 701,09 anywhere on the page — reading, at a glance, as if the payment "wasn't computed," even though `PayInvoiceModal`'s own "Em aberto" field (only visible once the modal is opened) would show the correct R$ 701,09.

**Why not fixed**: not investigated for a fix yet — the user asked to log the symptom now rather than debug live.

**How to apply**: when picked up, add an explicit "Pago" / "Restante a pagar" line next to "Total da fatura" (both already computable from `invoice.paidCents` and `outstanding`, no new query needed) rather than treating the gross total as the only headline number.

---

## 9. No edit path for a card's limit (or any other field) after creation

**Status**: `[ ]` open — reported by the user ("não consigo mexer no limite de um cartão").

**Where**: `lib/server/cards.ts`.

`lib/server/cards.ts` only exports `createCard` and `listCards` — there is no `updateCard`, and no edit UI anywhere under `/cards`. `limitCents`, `closingDay`, `dueDay`, `name`, and `accountId` are all set once at creation and have no revisit path, the same gap [[5]](#5-account-editing-covers-only-opening-balancedate) already documents for accounts.

**Why not fixed**: no edit story for cards has been scoped yet — creation-only was enough to satisfy Stage 3's setup-form story, and nothing since has added an edit path.

**How to apply**: follow the same shape as `updateAccountOpeningBalance` (item 5) — a dedicated update action + modal, validated with the same `CardInput` bounds already enforced at creation (`closingDay`/`dueDay` 1–28, `limitCents` positive).

---

## 10. Card screens never display closing/due day

**Status**: `[ ]` open — reported by the user ("não dá para ver vencimento, nem fechamento").

**Where**: `app/(app)/cards/page.tsx`, `app/(app)/cards/[id]/page.tsx`.

`Card.closingDay`/`Card.dueDay` are written once by `CreateCardModal` and read back internally (`assignInvoice(todayDateString(), card.closingDay, card.dueDay)` in `cards/[id]/page.tsx:46`) to pick the currently-open invoice, but neither value is ever rendered anywhere in the UI. Once a card is created there is no way to see, on-screen, which day it closes or which day it's due — only to infer it indirectly from which month an invoice lands in.

**Why not fixed**: no display story for these fields was ever scoped — `CreateCardModal`'s own helper text ("Compras feitas até o dia {closingDay} entram na fatura deste mês…") is the only place either value is ever shown, and only during creation, before the value is even saved.

**How to apply**: surface both values on `cards/page.tsx`'s card row and/or `cards/[id]/page.tsx`'s header alongside limit/committed/available — no new query needed, both fields are already on the `Card` record being fetched.

Related but separate from this: the **1–28 day range itself is an intentional, already-resolved product decision**, not a bug — `docs/agents/05-acceptance-criteria.md` explicitly requires `closingDay`/`dueDay` between 1 and 28 (same reasoning as `monthStartDay`'s R5 cap: avoids short-month edge cases on the 29th–31st). Don't reopen that constraint; this entry is only about the missing *display* of whatever value was chosen within it.

---

## Out of scope for this file

Product-level out-of-scope items (OFX import, multi-user UI, native mobile app, etc.) and unresolved *design* decisions belong in `docs/agents/07-open-decisions.md`, not here — this file is only about implementation shortcuts in already-specified behavior.