# 02 — Business rules

These rules are the product. If the UI diverges from them, the UI is wrong. Every one of them must have an automated test (`05-acceptance-criteria.md`).

---

## R1 — Moving money ≠ spending money

`TRANSFER`, `INVESTMENT_IN`, `INVESTMENT_OUT`, `GOAL_IN`, `GOAL_OUT`, and `CARD_PAYMENT` **never** count as income or expense, in any report, chart, limit, or month total.

Only `EXPENSE` counts as an expense. Only `INCOME` counts as income. `CARD_ADJUSTMENT` counts as an expense (it's a real charge), under the "Other" category or whichever one the user picks.

Reason: moving R$ 3,000 from checking to a CD doesn't make anyone poorer. Counting that as spend inflates expenses and destroys the readability of the month.

---

## R2 — Savings rate includes contributions

For a financial month:

```
income        = Σ INCOME
expenses      = Σ EXPENSE + Σ CARD_ADJUSTMENT
contributions = Σ INVESTMENT_IN − Σ INVESTMENT_OUT     (net, can be negative)
cashLeftover  = income − expenses − contributions
savingsRate   = (contributions + cashLeftover) / income
```

Note that `contributions + cashLeftover = income − expenses`, so the rate is mathematically `1 − expenses/income`. **Still, show all four lines separately** (income, expenses, contributions, cash leftover): the user needs to see how much of what was left actually got invested versus sitting idle. If `income = 0`, the rate is `null` (show "—", never 0% or a division by zero).

Reserving into a goal (`GOAL_IN`) does **not** enter this account: it's a label over money that's already counted in leftover or investment. Counting it would double it.

---

## R3 — Card invoice: when the purchase lands and when the money leaves

Each card has its own `closingDay` and `dueDay`.

**Invoice assignment**, at transaction creation (`method = CARD`):

```
if competenceDate.day <= card.closingDay
   → invoice closing this month
else
   → invoice closing next month
```

The invoice's reference month (`Invoice.referenceMonth`) is the **due month**. If `dueDay < closingDay`, the due date falls in the month after closing.

**Cash effects:**

- A card expense **does not** debit any account on the purchase date. It already counts as an expense for its accrual month (accrual basis), but the money only leaves on `CARD_PAYMENT`.
- `CARD_PAYMENT` debits the account (`Card.accountId` by default) and **is not an expense** (R1) — the purchases were already counted.
- Partial payment: records `paidCents` lower than the total; the remainder stays open and must show as the card's outstanding balance.
- `CARD_ADJUSTMENT` (interest, fees, chargeback) goes straight into the invoice, with no associated purchase.

**Available card limit** = `limitCents` − (sum of open, closed, unpaid invoices) − (sum of transactions in the invoice being formed) − (sum of already-contracted future installments). Utilization = committed / limit.

---

## R4 — Installments

When recording an installment purchase of `total` in `n` installments:

1. Create a `Purchase` and **n** `Transaction` rows (`installmentNo` 1..n), one per consecutive invoice starting from the invoice of the purchase date (R3).
2. Value of each installment: `floor(total / n)`. The **cent remainder goes into the last installment**. E.g. R$ 100.00 in 3× → 33.33 / 33.33 / 33.34.
3. Each installment gets the `invoiceId` of its corresponding invoice, one month at a time, advancing one month per installment.
4. **Each installment burdens its own financial month (R5), not the purchase month.** `competenceDate` — what `/month`, category limits, monthly alerts, the dashboard, and analysis all filter on — follows the same one-month-per-installment cadence as `invoiceId`: installment 1 keeps the real purchase date; installment N (N > 1) uses that installment's own invoice due date. Applies to every write path that creates installments (manual entry, CSV import of an in-progress purchase's remaining installments, recalculation on edit).
5. Editing the purchase recalculates the installments **not yet paid**; installments in an already-paid invoice don't change.
6. Deleting the purchase removes the future installments and keeps the already-paid ones (with a warning in the UI).

Installments already recorded before this rule (item 4) took effect keep their old `competenceDate` (the original purchase date) — see [`docs/epic/EPICS.md` #1](../epic/EPICS.md#1-backfill-competencedate-for-existing-installments) for the pending backfill.

Future installments are `CONFIRMED` — that's what lets the app say "how much of my future income is already committed."

---

## R5 — Configurable financial month

`Settings.monthStartDay` (1..28) defines the period. Financial month **M** is:

```
[ year-month-monthStartDay , year-(month+1)-monthStartDay )
```

The month's label is that of the **start** of the interval (with `monthStartDay = 5`, the period 05/Aug to 04/Sep is called "August"). Every aggregate — income, expenses, limits, savings rate, analysis — uses this interval, not the calendar month. Invoices keep their own ruler (R3); the two coexist and the UI must make clear which one it's showing.

Changing `monthStartDay` changes historical aggregates. Warn the user and never allow a silent automatic change.

---

## R6 — Recurrence occurrences

- `MONTHLY` with `dayOfMonth > days in the month` → last valid date of the month (31 in February = 28/29).
- An occurrence whose `competenceDate` is in the past with no matching `Transaction` is **pending**: the UI shows it under "to confirm" for the month, without counting it as realized. The user confirms it (creating the transaction) or skips the occurrence.
- `PAUSED` generates no occurrence and no projection; history stays intact.
- `endDate` ends the series; `ENDED` is the same with a past date.
- A recurrence with `method = CARD` generates its occurrence **on the invoice** per R3 (subscriptions), not on the account.

---

## R7 — Projection confidence

Every future value carries a `Confidence`, and the UI **must** visually differentiate it (see tokens):

| Level | What it is | Origin |
| --- | --- | --- |
| `REALIZED` | already happened | `Transaction` with date ≤ today |
| `CONFIRMED` | already committed | future installments, closed unpaid invoice |
| `RECURRING` | expected by rule | future occurrence of an active `RecurrenceRule` |
| `PROJECTED` | estimated | average variable spend (R8) |

Never sum different levels without showing the breakdown. "R$ 5,140 committed" ≠ "R$ 5,200 of expected expense."

---

## R8 — Variable spend projection

For each future month and each category of nature `VARIABLE`:

```
projected[cat] = average of cat's expenses over the last 3 closed financial months
                 (Settings.variableLookback)
```

Edge cases:

- **Less than 3 closed months of history**: don't project variable spend. Mark the month as *low confidence* and show the "projection with too little information" state (mockup `1ab`). It's more honest than estimating with n=1.
- `FIXED` and `COMMITMENT` categories are **not** projected by average: they come from recurrence rules (`RECURRING`). If a fixed expense exists without a rule, it won't show up in the projection — the app should suggest creating the recurrence.
- Future months beyond available history inherit the same average (flat line), with decreasing confidence in the UI (lower opacity from the 4th month onward, as in `1d`).
- Future one-off purchases are **not** estimated. The UI states this explicitly on the projected invoices screen (`1e`).

**Projected balance** for month M:

```
projectedBalance[M] = projectedBalance[M-1]
                     + expected income[M]
                     − expected account expenses[M]
                     − invoices due in M
                     − scheduled contributions[M]
```

with `projectedBalance[current month] = balance available today`.

---

## R9 — Goals ("porquinhos"): logical reserve

```
available    = Σ balance of accounts with includeInTotals
reserved     = Σ balance of all open Goals
freeToSpend  = available − reserved
```

If `reserved > available` (a goal backed by an investment), the UI shows the source backing it and `freeToSpend` doesn't go negative because of it — only subtract the portion of the goal that lives in an account (`Goal.accountId != null`).

**Required pace**:

```
monthsRemaining = months between today and targetDate (minimum 1)
requiredPace    = (targetCents − currentBalance) / monthsRemaining
avgContribution = average of the last 3 months' GOAL_IN
```

- `avgContribution >= requiredPace` → "On pace."
- Otherwise → "R$ X behind pace," where `X = requiredPace − avgContribution`, with two actions: increase the contribution or change the deadline.
- Without a `targetDate`: show only progress, never a pace alert.

---

## R10 — Purchase simulation

**Pure** function, no database writes, no side effects. Input:

```ts
type Simulation = {
  amountCents: number
  categoryId: string
  method: 'ACCOUNT' | 'CARD'
  cardId?: string
  accountId?: string
  installments: number   // 1 = cash/upfront
  when: 'THIS_MONTH' | 'NEXT_MONTH' | Date
}
```

Output (all as before/after pairs):

1. Current invoice and next invoice for the card.
2. Available limit and utilization (%) of the card.
3. The **category**'s limit in the month each installment lands.
4. Free to spend today.
5. Projected balance for the next `projectionMonths` months.
6. Monthly contribution capacity and impact on each goal with a deadline (delay in months).
7. **Warnings**, each with a reason and a number — never a dry "yes/no":
   - card utilization goes over `utilizationTarget`;
   - some installment blows past a category limit;
   - some month's projected balance drops below a minimum (use 0 by default; see `07`);
   - some goal gets delayed;
   - an explicit positive confirmation when none of the above occurs.
8. **Suggested alternative** (optional, high value): recompute with a number of installments that resolves the worst warning and show the difference (as in `1h`).

The result screen must make it obvious that **nothing was recorded** and offer "Record the real purchase," which then does create the transaction/installments with the same parameters.

---

## R11 — Net worth

```
netWorth = Σ account balances + Σ Investment.currentCents
           (− Σ open invoices, if Settings.netWorthSubtractsOpenInvoices)
```

Net worth is a **stock**; income/expenses are a **flow**. Never mix the two in the same number or chart. The monthly history is the value on the **last day of each financial month** — record a monthly snapshot (job or computed at read time, but with a stable past value).

Investment returns are **not income**: they enter net worth through updates to `currentCents` and show up as "return," outside the cash flow.

---

## R12 — Account balance

```
balance(account) = openingBalance
                  + Σ INCOME on the account
                  − Σ EXPENSE with method=ACCOUNT on the account
                  − Σ CARD_ADJUSTMENT? (no: stays on the invoice)
                  − Σ TRANSFER out + Σ TRANSFER in
                  − Σ INVESTMENT_IN + Σ INVESTMENT_OUT
                  − Σ CARD_PAYMENT out
```

Only transactions with `competenceDate <= today` enter the current balance. Future ones feed the projection.

---

## R13 — Alerts

Computed by query, ordered by severity, capped at **at most 3 "needs attention"** items on the dashboard (the rest live on the alerts screen). Each alert has a stable key (`alertKey`) so it can be dismissed, and **at least one action**.

| Trigger | Severity | Text (default) |
| --- | --- | --- |
| Category limit ≥ `warnAtPercent` | warning | "X% of {category}'s limit used" + projected month-end |
| Category limit exceeded | critical | "R$ X over the limit" + how many months in a row |
| Card utilization > target | warning | "Card utilization at X%" |
| Future invoice > 25% higher than previous | warning | "{month}'s invoice X% higher" + what caused it (new installments) |
| Some month's projected balance < 0 | critical | "Projected balance negative in {month}" |
| Goal behind pace | warning | "R$ X behind pace" |
| Variable category > 20% above the 6-month average | warning | "{category} X% above your average" |
| Large installment coming up (> 10% of average income) | info | "New installment of R$ X starts in {month}" |
| Variable category below average | positive | "{category} X% below average" |
| Net worth growing above target | positive | "Net worth growing R$ X/month" |

Tone: explain the number and offer a way out. Never guilt-tripping language, never an alarm without an action.

*Note: the "Text (default)" column above is copy shown to the end user — keep it in pt-BR in the actual implementation (`lib/copy.ts`), translating only the structure/placeholders as needed. See `04-design-tokens.md § Copy` for the exact terminology.*

---

## R14 — Onboarding (empty seed)

First access, in order — every step is skippable except the 1st:

1. **Financial month start day** (default: the payday they enter).
2. **One account** with a current balance (`2a`).
3. **Salary as a recurrence** (`1r`) — this is what makes the projection exist.
4. **One card** with closing and due days (`2b`), if they use a card.
5. **Fixed expenses and commitments** (`1q`) — quick list, several at once.
6. Optional: old open invoices (`2e`), investments (`2c`), goals, limits.

While there are fewer than 3 closed months, projection screens show the low-confidence state (R8) instead of made-up numbers.

---

## R15 — CSV batch import

Historical data can be imported in bulk from CSV files (one file per entity kind — despesas, receitas, transferencias, investimentos, porquinhos, faturas). See `docs/import-runbook.md` for the exact column format handed to whoever prepares the files.

**Two phases, never one:**

1. **Validate** (read-only) — parses every uploaded file, resolves every name (`categoria`, `conta`, `cartao`, `investimento`, `porquinho`) against existing records — **never auto-created**, same invariant as manual entry — and returns a per-row report (ok/warning/error) plus batch-level errors. Nothing is written.
2. **Commit** — re-validates (never trusts a stale client report), then creates rows in a fixed order: `despesas → receitas → transferencias → investimentos → porquinhos → faturas`, skipping any row flagged `warning`. Within `faturas`, `ajuste` rows commit before `pagamento` rows for the same invoice — a payment's total must already reflect same-invoice adjustments (R3).

**Tagging.** Every `Transaction` created by an import gets `importBatchId` (groups it under one `ImportBatch` — `01-data-model.md`) and `externalId` (required on every source row, used for dedup). A card purchase with `parcela_atual`/`total_parcelas` expands to one `externalId` per installment (`${id}#1`, `${id}#2`, ...).

**In-progress installment purchases.** A row can express a card purchase that's already partway through its installments (`parcela_atual`/`total_parcelas`, e.g. 2 of 4) instead of the full purchase from installment 1. The importer seeds **only** the remaining installments (current through last) as plain `EXPENSE` transactions on the card, dated one invoice-month apart — no `Purchase` row is created (the earlier installments' real amounts and the original purchase date aren't known, and inventing them would be guessing). This means these imported purchases don't get the `/purchases/[id]` "N de M paga" grouping, but the money that matters — future invoice totals and available card limit (R3) — is correct, because the not-yet-elapsed installments exist as real rows.

**Historical invoice payments.** A card invoice that was already paid off in real life must have a matching `faturas.csv` row with `tipo=pagamento`, or `calculateAvailableLimit` (R3) will treat it as unpaid forever and permanently understate available limit. The importer resolves/creates the `Invoice` for the given card + reference month the same way manual entry does (`findOrCreateInvoice`), then applies the payment exactly like paying a regular invoice — no special "past invoice" path, no `manualTotalCents` shortcut (that field is reserved for months genuinely absent from the import).

**Account window.** Before allowing a commit, every account referenced in the files is checked against its own `openingDate`: if any row predates it, the whole commit is blocked with one aggregated message per account (not one per row) telling the user to fix the account's opening date/balance first. Without this, backdated history behind a "today" opening balance would silently corrupt account balance, net worth, and free-to-spend (R12) with no error ever surfacing.

**Dedup.** `externalId` collisions default to **skip** — that row (or, for an installment purchase, that whole group) is left out of the commit with a warning, the rest of the batch proceeds normally. This is what makes re-uploading a corrected file after fixing a few rows safe.

**Undo — recompute, never reverse a delta.** Deletes every `Transaction` tagged with the batch, then for every `Invoice` that lost a transaction, recomputes `paidCents`/`paidAt` from whatever's left (never subtracts a stored delta) — an invoice left with zero transactions and no `manualTotalCents` is deleted outright. Same for `Purchase`. Undo is idempotent (`ImportBatch.status` guards against running it twice) and is the accepted compensating action for a commit that stops partway through a bad row — there's no giant all-or-nothing transaction wrapping an entire batch.
