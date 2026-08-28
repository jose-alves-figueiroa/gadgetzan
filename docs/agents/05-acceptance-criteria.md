# 05 — Acceptance criteria

Tests for **rules**, not pixels. If these pass, the app is correct where it matters. Suggestion: Vitest for the pure functions (`lib/finance/*`), Playwright for the flows.

## Rule R1 — moving money isn't spending

- [ ] Create a R$ 2,000 `TRANSFER` between two accounts: the month's expenses **don't change**; total available **doesn't change**; both account balances change by ±2,000.
- [ ] Create a R$ 3,000 `INVESTMENT_IN`: the month's expenses **don't change**; the account balance drops 3,000; invested rises 3,000; net worth **doesn't change**.
- [ ] Record a R$ 2,340 `CARD_PAYMENT`: the month's expenses **don't change**; the account balance drops 2,340; the invoice is marked paid.
- [ ] A R$ 18.40 `CARD_ADJUSTMENT` **counts** as an expense and lands on the invoice.

## Rule R2 — savings rate

- [ ] Income 15,000, expenses 9,200, contributions 3,000 → cash leftover 2,800 and rate **38.7%** (round to 1 decimal).
- [ ] Income 0 → rate `null`, UI shows "—".
- [ ] A 1,000 withdrawal (`INVESTMENT_OUT`) in the month → net contributions drop 1,000 and cash leftover rises 1,000; rate **doesn't change**.
- [ ] A 1,000 `GOAL_IN` doesn't change any of the four lines.

## Rule R3/R4 — invoice and installments

- [ ] Card closes on day 12. Purchase on 10/08 → August invoice (due 20/08 if `dueDay=20`). Purchase on 13/08 → September invoice.
- [ ] Two cards with different `closingDay`s: the same purchase date lands on different months' invoices, each following its own rule.
- [ ] A R$ 100.00 purchase in 3× → installments 33.33 / 33.33 / **33.34**, across three consecutive invoices.
- [ ] A R$ 6,000 purchase in 10× on 08/08 → installment 1 on the August invoice and installment 10 on the May/2027 invoice; the September invoice rises by exactly 600.
- [ ] Editing the purchase to 6× recalculates only the unpaid installments.
- [ ] The card's available limit deducts already-contracted future installments.
- [ ] A partial payment leaves a visible outstanding balance on the card.

## Rule R5 — financial month

- [ ] `monthStartDay = 5`: a 04/09 transaction belongs to the month labeled **August**; 05/09 belongs to September.
- [ ] `monthStartDay = 31` is rejected by the form (max 28).
- [ ] Changing `monthStartDay` shows a warning that historical aggregates will change.

## Rule R6 — recurrences

- [ ] A monthly rule on day 31 generates an occurrence on 28/02 (or 29 in a leap year).
- [ ] An occurrence with a past date and no transaction shows up as **pending**, without entering "realized."
- [ ] Pausing the rule removes future occurrences from projections and keeps the history.
- [ ] A recurrence with `method = CARD` shows up in the projected invoice, not as an account outflow.

## Rule R7/R8 — projection

- [ ] With 0–2 closed months: no variable spend projection; the month is marked low confidence; the UI shows the explanatory state.
- [ ] With 3 closed months: category projection = arithmetic average of the 3, per `VARIABLE` category.
- [ ] `FIXED`/`COMMITMENT` categories only enter the projection via a recurrence rule.
- [ ] Every future value exposed by the API carries `confidence`; the UI visually differentiates `CONFIRMED` from `PROJECTED`.
- [ ] `projectedBalance[current month] == balance available today`.
- [ ] Registering a 15,000 recurring salary immediately changes expected income for all future months.

## Rule R9 — goals

- [ ] Available 5,000 with goals of 2,000 and 1,500 → free to spend **1,500**.
- [ ] A goal backed by an investment doesn't reduce free-to-spend.
- [ ] Target 12,000, saved 7,500, deadline in 4 months, average contribution 1,000 → required pace 1,125 → status "R$ 125 behind pace" ("R$ 125 abaixo do ritmo").
- [ ] A goal with no target date generates no pace alert.

## Rule R10 — simulation

- [ ] Running a simulation **creates no** row in `Transaction` (check the count before/after).
- [ ] Simulating R$ 3,000 in 10× on a card: current invoice +300, next invoice +300, available limit −3,000, utilization recalculated, projected balance for the next 5 months −300 each.
- [ ] A simulation that crosses the utilization target returns a warning **with the number** and the target.
- [ ] A simulation that busts a category limit returns a warning pointing to the installment's month.
- [ ] A harmless simulation returns an explicit positive confirmation.
- [ ] "Record the real purchase" creates the purchase with exactly the simulated parameters.

## Rule R11/R12 — net worth and balance

- [ ] Net worth = sum of accounts + investments (± open invoices per the setting).
- [ ] Updating an investment's `currentCents` changes net worth and creates **no** income.
- [ ] A transaction with a future date doesn't change the account's current balance.
- [ ] A closed month's net worth history doesn't change when navigating (stable value).

## Rule R13 — alerts

- [ ] A limit at 85% with `warnAtPercent = 80` generates a warning alert with amount used, total, and days remaining.
- [ ] An exceeded limit generates a critical alert and states the number of consecutive months.
- [ ] A future invoice 32% higher than the previous one generates an alert that **names** the installments responsible.
- [ ] The dashboard never shows more than 3 warning-level alerts.
- [ ] A dismissed alert doesn't reappear in the same month.
- [ ] Every alert has at least one clickable action.

## End-to-end flows (Playwright)

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

## Form validations

- [ ] Amount required and > 0; accepts "1.234,56" and "1234,56" as input.
- [ ] Expense and income require a category; a transfer requires two distinct accounts.
- [ ] Installments between 1 and 48; installment value recalculated as you type.
- [ ] Date can't be earlier than the account's `openingDate`.
- [ ] A card requires `closingDay` and `dueDay` between 1 and 28.
- [ ] Error messages in pt-BR, below the field, no toast.

## Non-functional

- [ ] Dashboard loads in < 500ms with 5 years of history (~6,000 transactions) — index on `(userId, competenceDate)`.
- [ ] No financial computation in `Float`; everything in `Int` cents.
- [ ] Timezone and dates: no "off by one day"; accrual dates are `date`, compared without a time component.
- [ ] Accessibility: visible focus everywhere, targets ≥ 44px on mobile, body text contrast ≥ 4.5:1 (don't use the accent color for small text — use `accent-300`).
