# 05 — Acceptance criteria

Tests for **rules**, not pixels. If these pass, the app is correct where it matters. Suggestion: Vitest for the pure functions (`lib/finance/*`), Playwright for the flows.

Status convention: `[x]` verified (by a Vitest test, an e2e flow, or direct code/live check — see the note on each item where it isn't a Vitest test) — checked during Stage 7 (E7-S6/S7). `[ ]` with a note is a genuine, checked-for gap, not an oversight.

## Rule R1 — moving money isn't spending

- [x] Create a R$ 2,000 `TRANSFER` between two accounts: the month's expenses **don't change**; total available **doesn't change**; both account balances change by ±2,000. — `lib/finance/transactions.test.ts`, `lib/finance/accounts.test.ts`; e2e flow #5.
- [x] Create a R$ 3,000 `INVESTMENT_IN`: the month's expenses **don't change**; the account balance drops 3,000; invested rises 3,000; net worth **doesn't change**. — `transactions.test.ts`, `accounts.test.ts`, `networth.test.ts`.
- [x] Record a R$ 2,340 `CARD_PAYMENT`: the month's expenses **don't change**; the account balance drops 2,340; the invoice is marked paid. — `transactions.test.ts`, `accounts.test.ts`; e2e flow #9.
- [x] A R$ 18.40 `CARD_ADJUSTMENT` **counts** as an expense and lands on the invoice. — `transactions.test.ts`.

## Rule R2 — savings rate

- [x] Income 15,000, expenses 9,200, contributions 3,000 → cash leftover 2,800 and rate **38.7%** (round to 1 decimal). — `savings.test.ts`.
- [x] Income 0 → rate `null`, UI shows "—". — `savings.test.ts` (null); dashboard/`month` pages render `savingsRate === null ? "—" : ...`.
- [x] A 1,000 withdrawal (`INVESTMENT_OUT`) in the month → net contributions drop 1,000 and cash leftover rises 1,000; rate **doesn't change**. — `savings.test.ts`.
- [x] A 1,000 `GOAL_IN` doesn't change any of the four lines. — `savings.test.ts`.

## Rule R3/R4 — invoice and installments

- [x] Card closes on day 12. Purchase on 10/08 → August invoice (due 20/08 if `dueDay=20`). Purchase on 13/08 → September invoice. — `invoice.test.ts`.
- [x] Two cards with different `closingDay`s: the same purchase date lands on different months' invoices, each following its own rule. — `invoice.test.ts`.
- [x] A R$ 100.00 purchase in 3× → installments 33.33 / 33.33 / **33.34**, across three consecutive invoices. — `installments.test.ts`.
- [x] A R$ 6,000 purchase in 10× on 08/08 → installment 1 on the August invoice and installment 10 on the May/2027 invoice; the September invoice rises by exactly 600. — `installments.test.ts`; e2e flow #3.
- [x] Editing the purchase to 6× recalculates only the unpaid installments. — `installments.test.ts`. UI to actually edit a stored purchase is still deferred (flagged since Stage 3/5 — installment recalculation UI is real work of its own); the pure recalculation logic itself is covered and correct.
- [x] The card's available limit deducts already-contracted future installments. — `invoice.test.ts` (`calculateAvailableLimit`).
- [x] A partial payment leaves a visible outstanding balance on the card. — `invoice.test.ts`; `/cards/[id]` renders the outstanding amount.

## Rule R5 — financial month

- [x] `monthStartDay = 5`: a 04/09 transaction belongs to the month labeled **August**; 05/09 belongs to September. — `period.test.ts`.
- [x] `monthStartDay = 31` is rejected by the form (max 28). — `period.test.ts` (`isValidMonthStartDay`); `SettingsForm`'s `Field` has `min={1} max={28}`, and `updateMonthStartDay`'s zod schema rejects it server-side too.
- [x] Changing `monthStartDay` shows a warning that historical aggregates will change. — `SettingsForm` (Stage 7, E7-S5): inline warning shown when the field's value differs from the saved one.

## Rule R6 — recurrences

- [x] A monthly rule on day 31 generates an occurrence on 28/02 (or 29 in a leap year). — `recurrence.test.ts`.
- [ ] An occurrence with a past date and no transaction shows up as **pending**, without entering "realized." — the pure function exists (`isOccurrencePending`, tested in `recurrence.test.ts`) but is **not wired into any screen**. It takes `hasTransaction: boolean` as a parameter by design (matching-logic is a data-access concern, kept out of `lib/finance`) — no caller has ever implemented that matching (no linking key exists between a generated occurrence and the `Transaction` that fulfills it). Flagged since Stage 3's recurrences list ("view upcoming occurrences… deferred"); Stage 7 wired *future* occurrences into `/calendar` (unambiguous — see `lib/server/calendar.ts`) but deliberately left this harder past-occurrence case unsolved rather than inventing a matching heuristic.
- [x] Pausing the rule removes future occurrences from projections and keeps the history. — `recurrence.test.ts` (`PAUSED` generates nothing); `pauseRecurrenceRule` only flips `status`, never touches stored transactions.
- [x] A recurrence with `method = CARD` shows up in the projected invoice, not as an account outflow. — `recurrence.test.ts` (`occurrenceTarget`); `lib/server/future.ts` routes `CARD` occurrences into `invoiceRecurring`, never `expenseRecurring`.

## Rule R7/R8 — projection

- [x] With 0–2 closed months: no variable spend projection; the month is marked low confidence; the UI shows the explanatory state. — `projection.test.ts`; `components/ui/LowConfidence.tsx` (Stage 7) wired into the dashboard and `/future`.
- [x] With 3 closed months: category projection = arithmetic average of the 3, per `VARIABLE` category. — `projection.test.ts`.
- [x] `FIXED`/`COMMITMENT` categories only enter the projection via a recurrence rule. — `lib/server/future.ts` only ever adds `FIXED`/`COMMITMENT` spend through `occurrences` (generated from `RecurrenceRule`s), never from a variable-average projection.
- [x] Every future value exposed by the API carries `confidence`; the UI visually differentiates `CONFIRMED` from `PROJECTED`. — `projection.test.ts` (`groupByConfidence`); `/future`'s stacked bar and `Tag` component both distinguish Confirmado/Recorrente/Projetado by color per `04-design-tokens.md`.
- [x] `projectedBalance[current month] == balance available today`. — `projection.test.ts`.
- [x] Registering a 15,000 recurring salary immediately changes expected income for all future months. — `projection.test.ts`; e2e flow #1 (onboarding's salary step, reflected on the dashboard immediately after).

## Rule R9 — goals

- [x] Available 5,000 with goals of 2,000 and 1,500 → free to spend **1,500**. — `goals.test.ts`.
- [x] A goal backed by an investment doesn't reduce free-to-spend. — `goals.test.ts`.
- [x] Target 12,000, saved 7,500, deadline in 4 months, average contribution 1,000 → required pace 1,125 → status "R$ 125 behind pace" ("R$ 125 abaixo do ritmo"). — `goals.test.ts`.
- [x] A goal with no target date generates no pace alert. — `goals.test.ts`; e2e flow #6 verifies the whole create→contribute→pace path live.

## Rule R10 — simulation

- [x] Running a simulation **creates no** row in `Transaction` (check the count before/after). — `simulate.test.ts` (purity test); e2e flow #8 explicitly counts transactions before/after the simulate step and confirms no change.
- [x] Simulating R$ 3,000 in 10× on a card: current invoice +300, next invoice +300, available limit −3,000, utilization recalculated, projected balance for the next 5 months −300 each. — `simulate.test.ts`.
- [x] A simulation that crosses the utilization target returns a warning **with the number** and the target. — `simulate.test.ts`.
- [x] A simulation that busts a category limit returns a warning pointing to the installment's month. — `simulate.test.ts`.
- [x] A harmless simulation returns an explicit positive confirmation. — `simulate.test.ts`.
- [x] "Record the real purchase" creates the purchase with exactly the simulated parameters. — `simulate.test.ts`; e2e flow #8 (`Registrar a compra real` end to end).

## Rule R11/R12 — net worth and balance

- [x] Net worth = sum of accounts + investments (± open invoices per the setting). — `networth.test.ts`.
- [x] Updating an investment's `currentCents` changes net worth and creates **no** income. — `networth.test.ts`.
- [x] A transaction with a future date doesn't change the account's current balance. — `accounts.test.ts`.
- [x] A closed month's net worth history doesn't change when navigating (stable value). — reconstructed at read time by replaying stored transactions (`lib/server/networth.ts`), deterministic for a fixed transaction set; flagged in Stage 5's report that invested-history specifically assumes flat market value between snapshots (no valuation-history table) — a documented approximation, not an instability.

## Rule R13 — alerts

- [x] A limit at 85% with `warnAtPercent = 80` generates a warning alert with amount used, total, and days remaining. — `alerts.test.ts`; e2e flow #7.
- [x] An exceeded limit generates a critical alert and states the number of consecutive months. — `alerts.test.ts`.
- [x] A future invoice 32% higher than the previous one generates an alert that **names** the installments responsible. — `alerts.test.ts`.
- [x] The dashboard never shows more than 3 warning-level alerts. — `alerts.test.ts`.
- [x] A dismissed alert doesn't reappear in the same month. — `alerts.test.ts`.
- [x] Every alert has at least one clickable action. — `alerts.test.ts`.

## Rule R15 — CSV batch import

- [x] Validation never writes to the database — parses, resolves names, checks dedup/account-window, returns a report. — `import.test.ts` (row-shape), `csv.test.ts` (parsing); `validateImportCsvs` only issues `findMany`/`aggregate` reads.
- [x] A row referencing a category/account/card/investment/goal name that doesn't exist is an error naming the exact text typed, never auto-created. — `lib/server/imports/validate.ts` `lookupOrFail`.
- [x] A card expense with `parcela_atual`/`total_parcelas` (e.g. 2 of 4) seeds only installments 2–4, one invoice-month apart, no `Purchase` row. — `installments.test.ts` (`buildRemainingInstallmentPlan`); verified live: available card limit drops by exactly the sum of the seeded installments.
- [x] A backdated row for an account whose `openingDate` is later produces one aggregated batch-level error (not one per row) and blocks commit entirely. — `lib/server/imports/validate.ts` `checkAccountWindows`; verified live.
- [x] Re-uploading a file with a previously-imported `id_externo` skips that row/installment-group with a warning; the rest of the batch commits normally. — `flagExternalIdCollisions`.
- [x] Undoing a batch deletes every transaction it created, recomputes (never reverses a delta) `paidCents`/`paidAt` on every affected invoice from what's left, deletes invoices/purchases left with nothing, and is idempotent (a second undo on the same batch is rejected). — `lib/server/imports/undo.ts`; verified live end-to-end (see below).
- [x] A `faturas.csv` payment row correctly sets `Invoice.paidAt` so `calculateAvailableLimit` stops counting that invoice as unpaid. — verified live: card's available limit returns to the full `limitCents` after undo.

**Verified live** (not yet an automated Playwright flow — see #11 below): uploaded a 2-row `despesas.csv` (one plain account expense, one card purchase at installment 2/4) against the running dev database. Validate correctly blocked commit on a backdated row (account-window check), then passed once the date was fixed. Commit created exactly 4 transactions (1 + 3 remaining installments). Card's available limit dropped by the sum of the 3 installments. Undo deleted all 4 transactions, deleted the 3 now-empty invoices, and restored the card's available limit to the original full limit.

## End-to-end flows (Playwright)

All 10 implemented in `e2e/flows.spec.ts` (Stage 7, E7-S6) and passing, stable across repeat runs — see `e2e/README.md` for the isolated harness (dedicated database, never dev or Docker's data).

1. Onboarding: month start day → account → salary → card → lands on the dashboard with an income projection.
2. Create an expense recurrence and see the value show up in Próximos meses and in Calendário.
3. Create a 10× installment purchase and see the projected invoices rise by 600/month.
4. Navigate from the dashboard to next month and check the four forecast lines.
5. Transfer between accounts and check expenses didn't change.
6. Create a goal, contribute to it, see progress and pace status.
7. Create a category limit, spend up to 85%, and see the alert.
8. Simulate a purchase, read the warnings, convert it into a real transaction.
9. Pay an invoice and check the account balance and month expenses.
10. Close out the month: open the month screen and check the donut, limits, and contributions.
11. **Not yet automated** — Import a small CSV, see the validation report, confirm, check account balance/card limit/invoice `paidAt`, undo, check everything reverted exactly.

## Form validations

- [x] Amount required and > 0; accepts "1.234,56" and "1234,56" as input. — `money.test.ts` (`toCents`); `centsPositive` zod schema on every write.
- [x] Expense and income require a category; a transfer requires two distinct accounts. — `categoryId` is a `required` `<select>` server-validated via zod (`NewTransactionInput`); `createTransfer` throws when `accountId === toAccountId`.
- [x] Installments between 1 and 48; installment value recalculated as you type. — `installments: z.number().int().min(1).max(48)` (server-side, not just the `Field`'s `min`/`max`); the modal's `hint` recomputes the per-installment value on every keystroke.
- [x] Date can't be earlier than the account's `openingDate`. — was **not implemented anywhere** until Stage 7 (a real gap this checklist pass caught): added `assertDateNotBeforeOpening` in `lib/server/transactions.ts`, wired into `createTransaction`'s ACCOUNT branch, `createTransfer` (both accounts), and `createInvestmentMove`. Not applied to CARD-method purchases — the criterion names "the account's `openingDate`" and a card purchase isn't tied to one directly (only via its underlying debit account), which the acceptance text doesn't disambiguate.
- [x] A card requires `closingDay` and `dueDay` between 1 and 28. — `CardInput` zod schema (`lib/server/cards.ts`), server-side, not just the form's `min`/`max`.
- [x] Error messages in pt-BR, below the field, no toast. — consistent pattern across every modal/form in the app (`<p className="text-micro text-neg">{error}</p>` immediately below the submit button, inline).

## Non-functional

- [x] Dashboard loads in < 500ms with 5 years of history (~6,000 transactions) — index on `(userId, competenceDate)`. — index existed since the Stage 0 schema; timing verified live with `scripts/perf-check.ts` (Stage 7, E7-S7): ~300ms steady-state, 348ms average over 5 runs.
- [x] No financial computation in `Float`; everything in `Int` cents. — audited (Stage 7): zero `Float` schema columns, zero `Float`/`parseFloat` usage outside one explanatory code comment.
- [x] Timezone and dates: no "off by one day"; accrual dates are `date`, compared without a time component. — `lib/finance/period.ts` does all date arithmetic on plain `YYYY-MM-DD` strings (never a `Date` with time-of-day), covered by `period.test.ts`'s month-boundary and year-rollover tests; enforced project-wide by CLAUDE.md § Dates.
- [x] Accessibility: visible focus everywhere, targets ≥ 44px on mobile, body text contrast ≥ 4.5:1 (don't use the accent color for small text — use `accent-300`). — Stage 7, E7-S3/S4: global `:focus-visible` outline (since Stage 1), `max-md:min-h-11` touch targets on `Button`/nav, full `text-accent` contrast audit moving ad hoc small-text cases to `accent-300`.
