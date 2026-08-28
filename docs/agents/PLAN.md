# Implementation plan — Gadgetzan

This file is the work backlog, derived from `docs/agents/`. Each story points to the rule (`Rn`), the screen (`03-screens.md`, mockup id), and the acceptance criterion (`05-acceptance-criteria.md`) that validate it. Work follows the stage order; don't skip a stage with a red test.

*Note: screen names, field labels, and copy quoted below are the actual pt-BR app terminology — kept as-is since that's what ships to the user. See `04-design-tokens.md § Copy`.*

Status convention: `[ ]` to do · `[~]` in progress · `[x]` done.

---

## Decisions already resolved (07-open-decisions.md)

The product owner already answered D1–D6 inline in that document. Apply them directly, don't reopen:

| # | Decision | Resolution applied | Technical impact |
| --- | --- | --- | --- |
| D1 | Does net worth subtract open invoices? | No (not implementing debt tracking for now) | `Settings.netWorthSubtractsOpenInvoices` stays `false`, no UI to change it for now |
| D2 | Configurable floor for projected balance? | Yes | Add `Settings.minCashCents Int?` to the schema; R10 and R13 use this value instead of a hardcoded `0` |
| D3 | 13th salary / irregular income | No automatic bake-in. User enters it manually every month OR creates a `RecurrenceRule` with `frequency = YEARLY` | No special logic — `Frequency.YEARLY` already exists in the schema (`monthOfYear`); make sure the projection engine (R8) handles `YEARLY` correctly |
| D4 | Does the total monthly limit include commitments? | Excludes `COMMITMENT` by default, with a toggle | Add `Limit.includeCommitments Boolean @default(false)` (only relevant when `scope = TOTAL_MONTH`) |
| D5 | Is one invoice per card per month enough? | Yes | Keep `@@unique([cardId, referenceMonth])` as is |
| D6 | Investment return: manual or computed? | Manual. Don't implement return calculation now | Buttons/flow for "record a return" on screen `1p` stay **disabled** (visible placeholder, no action) |

Two schema changes come out of this and land in Stage 1: `Settings.minCashCents` and `Limit.includeCommitments`. I'll flag them in the schema with a short comment pointing at the rule (not the conversation number).

---

## Stage 0 — Scaffolding (prerequisite for Stage 1)

Mechanical bootstrap tasks, no product logic. Do this before opening Stage 1 for real.

- [ ] `git init` on the repo (it isn't a git repository yet) + `.gitignore` (node_modules, .env, .next; don't ignore prisma/migrations)
- [ ] `create-next-app` (App Router, TypeScript, Tailwind, no `src/`) at the root
- [ ] Folder structure per `06-stack-and-deploy.md`: `app/(auth)`, `app/(app)`, `components/ui`, `components/finance`, `components/layout`, `lib/finance`, `prisma/`
- [ ] Install deps: `prisma`, `@prisma/client`, `next-auth`, `zod`, `argon2` (or `bcrypt`), `date-fns`, `date-fns-tz`, `@phosphor-icons/react`, `recharts` (or `visx`), `vitest`, `@testing-library/react` if needed, `playwright`
- [ ] `tailwind.config.ts` with the tokens from `04-design-tokens.md` (colors, ramps, 0.7× spacing, radii, Inter typography 400/500/600)
- [ ] Inter loaded from Google Fonts via `next/font`
- [ ] Initial `prisma/schema.prisma` (full schema from `01`, + `minCashCents` and `includeCommitments` from D2/D4)
- [ ] `docker-compose.yml` and multi-stage `Dockerfile` (`06-stack-and-deploy.md`), `next.config` with `output: 'standalone'`
- [ ] `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`)
- [ ] `vitest.config.ts` and `playwright.config.ts`
- [ ] `scripts/create-user.ts` (creates the single user via CLI, password hash)
- [ ] `prisma/seed.ts` — default categories only, from the list in `01-data-model.md`
- [ ] Root README with local setup instructions (docker compose up, migrate, seed, create-user)

**Stage 0 definition of done**: `pnpm dev` serves an authenticatable (or stub) blank page, `pnpm test` runs (even with no tests yet), `docker compose up` brings up a healthy Postgres.

---

## Stage 1 — Foundation

**Goal**: schema live, auth working, visual shell (`1a`) navigable with empty data, base components ready for the following stages.

- [ ] **E1-S1** As the app owner, I want the full Prisma schema from `01-data-model.md` (+ D2/D4) migrated on Postgres, so every following stage has somewhere to write data.
- [ ] **E1-S2** As the single user, I want to log in with an email/password created via script, so I can access the app without a public signup screen (`06 § Auth`).
- [ ] **E1-S3** As a user, I want every route outside `/login` to require a valid session, so the app isn't exposed on the local network without authentication (`middleware.ts`).
- [ ] **E1-S4** As a user, I want to see the sidebar (212px, "Hoje"/"Planejamento" groups) and the topbar (month selector, search, **+ Novo lançamento**, avatar) per mockup `1a`, so I can navigate across all the product's screens.
- [ ] **E1-S5** As a user, I want constant access to the **+ Novo lançamento** and **Simular compra** buttons on every screen, so I never need to go back to the dashboard to act (`03 § Shell`).
- [ ] **E1-S6** As a developer, I want the base components (`Button`, `Field`, `Segmented`, `Card`, `Tag`, `Table`, `Modal`, `Bar`, `Donut`, `Tooltip`) implemented with the tokens from `04`, so I can reuse them across every screen without redefining style.
- [ ] **E1-S7** As a developer, I want the shell's footer ("Ajustes") and the minimal responsive behavior (drawer < 1024px) sketched out, so Stage 7 only needs to refine it, not rebuild it.

**DoD**: clean `pnpm build`, working local login, navigable shell (routes can be "under construction" stubs), green `pnpm test` (even if empty of rules so far).

---

## Stage 2 — Financial engine (the core)

**Goal**: all the pure functions in `lib/finance/`, no UI, each with Vitest tests derived from `05-acceptance-criteria.md`. Don't move on with a red test.

One story per rule — all phrased as "As the system, I need to correctly compute X, so the UI never shows a wrong number":

- [ ] **E2-R1** `lib/finance/transactions.ts` (or inside the queries) — `TRANSFER`, `INVESTMENT_IN/OUT`, `GOAL_IN/OUT`, `CARD_PAYMENT` never count as income/expense; `CARD_ADJUSTMENT` counts as an expense. Tests: the 4 R1 checkboxes in `05`.
- [ ] **E2-R2** `lib/finance/savings.ts` — savings rate with the 4 lines (income, expenses, contributions, cash leftover), `null` when income = 0. Tests: the 4 R2 checkboxes.
- [ ] **E2-R3** `lib/finance/invoice.ts` — invoice assignment by `closingDay`/`dueDay`, `referenceMonth` = due month, available card limit. Tests: 7 R3/R4 checkboxes (invoice part).
- [ ] **E2-R4** `lib/finance/installments.ts` — installment split with the remainder on the last one, `installmentNo` 1..n, recalculation of unpaid installments on edit, removal of future installments on delete. Tests: part of R3/R4.
- [ ] **E2-R5** `lib/finance/period.ts` — configurable financial month (`monthStartDay` 1..28), label from the interval's start. Tests: the 3 R5 checkboxes.
- [ ] **E2-R6** `lib/finance/recurrence.ts` — occurrence generation (`MONTHLY`/`WEEKLY`/`YEARLY`), short-month truncation, pending status for a past occurrence with no transaction, `PAUSED`/`ENDED`, `method = CARD` lands on the invoice. Tests: the 4 R6 checkboxes.
- [ ] **E2-R7** `lib/finance/projection.ts` (confidence) — every future value carries a `Confidence` (`REALIZED`/`CONFIRMED`/`RECURRING`/`PROJECTED`), never summed without a visible breakdown. Tests: part of R7/R8.
- [ ] **E2-R8** `lib/finance/projection.ts` (variable) — average of the last `variableLookback` closed months per `VARIABLE` category; no projection with < 3 closed months; `FIXED`/`COMMITMENT` only via recurrence; `projectedBalance[current month] == balance available today`. Tests: the 6 R7/R8 checkboxes.
- [ ] **E2-R9** `lib/finance/goals.ts` — free to spend (`available − reserved`, an investment-backed goal doesn't subtract), required pace vs. average contribution. Tests: the 4 R9 checkboxes.
- [ ] **E2-R10** `lib/finance/simulate.ts` — pure simulation function (full R10: invoice before/after, category limit, projected balance, impact on goals, warnings with a number, suggested alternative), using `Settings.minCashCents` (D2) as the floor. **Writes nothing.** Tests: the 6 R10 checkboxes.
- [ ] **E2-R11** `lib/finance/networth.ts` — net worth = accounts + investments (± open invoices per the setting, always `false` for now per D1); stable monthly snapshot in the past. Tests: the 4 R11/R12 checkboxes.
- [ ] **E2-R12** `lib/finance/accounts.ts` (balance) — account balance via the R12 formula, only `competenceDate <= today` enters the current balance. Tests: part of R11/R12.
- [ ] **E2-R13** `lib/finance/alerts.ts` — the 10 triggers from the R13 table, ordered by severity, max 3 "warning" items on the dashboard, stable and dismissible `alertKey`, at least one action per alert, using `Limit.includeCommitments` (D4) for the total limit. Tests: the 6 R13 checkboxes.
- [ ] **E2-Limits** `lib/finance/limits.ts` — limit utilization (category, total, card), respecting D4 (commitments excluded from the total by default).
- [ ] **E2-Money** `lib/finance/money.ts` — `toCents`, `formatBRL`, parsing "1.234,56" and "1234,56" (covers the validation in `05 § Form validations`).

**DoD**: `pnpm test` with one test per checkbox in `05` (rules R1–R13), 100% green, no `Float` anywhere in a monetary computation, clean `pnpm build`.

---

## Stage 3 — Setup forms and transactions

**Goal**: data can enter the system. Onboarding works.

- [ ] **E3-S1** Account setup (`2a`): institution, nickname, type, current balance + date (doesn't generate a backdated transaction), include in totals.
- [ ] **E3-S2** Card setup (`2b`): name, debit account, limit, closing/due day (1–28, validated per `05`), utilization alert, block explaining the consequence of the closing date.
- [ ] **E3-S3** Category setup (`2d`): name, nature (fixed/variable/commitment), icon, optional limit.
- [ ] **E3-S4** Investment setup (`2c`): name, type, account, applied amount, current value, liquidity, option to debit the contribution now, preview showing expenses don't change (R1).
- [ ] **E3-S5** Recurrences — create/edit (`1r`): income/expense segmented control, frequency + day, preview of the next 3 occurrences (R6), note that it will start appearing in projections.
- [ ] **E3-S6** Recurrences — list (`1q`): 4 KPIs, 3 groups (Receitas/Compromissos/Despesas), pause/end/view upcoming occurrences.
- [ ] **E3-S7** New transaction modal (`1j`): 5 segmented types, installments with computed value, "despesa fixa" checkbox, "Impacto ao salvar" block (invoice before→after, via `lib/finance`), validations from `05`.
- [ ] **E3-S8** Transfer modal (`1l`): origin→destination account, "não entra em receitas nem despesas" note, preview of both balances.
- [ ] **E3-S9** Transaction list (`1i`): filters by type/account/category/period, grouped by day, period totals.
- [ ] **E3-S10** Transaction detail (`1k`): metadata, affected limit bar, delete/duplicate/edit actions.
- [ ] **E3-S11** Onboarding (R14, `1aa` flow): financial month start day → account → recurring salary → card → bulk fixed expenses/commitments → (optional) old invoices, investments, goals, limits.

**DoD**: Playwright flow #1 (onboarding) and #2 (a recurrence shows up in Próximos meses/Calendário — partial, the future screens don't exist yet, just validate that it's saved) pass. Clean `pnpm test` + `pnpm build`.

---

## Stage 4 — Present

**Goal**: the screens that answer "where do I stand right now."

- [ ] **E4-S1** Dashboard (`1a`): 3 KPIs (net worth, available balance, next invoice), current month realized (5 lines + stacked bar), grid with next-month forecast + projected invoices + alerts + goals + upcoming events. States: empty onboarding, low confidence < 3 months.
- [ ] **E4-S2** Month screen (`3a`): KPIs vs. previous month, composition donut, month limits, "what you saved," "what changed" with insights and 6-month bars.
- [ ] **E4-S3** Accounts (`1m`): 3 KPIs, one card per account with cards/investments indented, total available.
- [ ] **E4-S4** Account detail (`1n`): balance, transfer/new-transaction actions, 3 KPIs, latest transactions.
- [ ] **E4-S5** Cards + current invoice (`1o`): limit/committed/available, utilization, invoice table for the selected month.
- [ ] **E4-S6** Investments (`1p`): total + month return (manual, D6), distribution, table, note on how much is reserved for goals, contribute/withdraw actions (return disabled).
- [ ] **E4-S7** Invoice operations (`2e`): pay (full/partial), adjust (with a reason), enter a past invoice (onboarding for an already-open invoice).

**DoD**: Playwright flows #5 (transfer), #9 (pay an invoice), #10 (close out the month) pass.

---

## Stage 5 — Future

**Goal**: the screens that answer "what's coming."

- [ ] **E5-S1** Upcoming months (`1d`): 6 cards, next month highlighted, decreasing opacity past the 4th month, stacked bars of committed spend.
- [ ] **E5-S2** Projected invoices (`1e`): table by month with status (Realizado/Confirmado/Projetado), note about future one-off purchases not being estimated.
- [ ] **E5-S3** Installment purchase detail (`1f`): progress, installment list by status, view-on-invoice / edit actions.
- [ ] **E5-S4** Calendar (`1s`): Agenda and Month modes, sidebar with lowest balance of the month and its date.
- [ ] **E5-S5** Net worth (`1x`): 6M/12M/All selector, available/invested breakdown, monthly bars, growth insight vs. target.

**DoD**: Playwright flow #3 (10× installment purchase raises the projected invoice), #4 (dashboard → next month, the 4 lines check out).

---

## Stage 6 — Decision

**Goal**: the screens that help decide.

- [ ] **E6-S1** Limits — list (`1t`): total card (respecting D4), per category/card card, severity colors.
- [ ] **E6-S2** Limits — create/edit modal (`1u`): category, amount, period, warn at 70/80/90%, 6-month history.
- [ ] **E6-S3** Goals — list (`1v`): top card (R9), goal grid, ghost "Criar porquinho" card.
- [ ] **E6-S4** Goals — detail (`1w`): progress, pace verdict, transactions, save/withdraw.
- [ ] **E6-S5** Alerts (`1z`): "Pedem atenção" / "Boas notícias," an action per card, link to Ajustes.
- [ ] **E6-S6** Analysis (`1y`): category/card/account segmented control, spend nature, monthly expenses, variance insight.
- [ ] **E6-S7** Simulator (`1g`): the full input form (R10 input side).
- [ ] **E6-S8** Simulation result (`1h`): verdict, 5 before→after KPIs, solid/dashed line chart, suggested alternative, "record the real purchase."

**DoD**: Playwright flows #6 (goal), #7 (limit + alert), #8 (simulation → real transaction).

---

## Stage 7 — Polish

- [ ] **E7-S1** Empty/loading/error/low-confidence states (`1ab`) on every data screen listed in Stages 3–6.
- [ ] **E7-S2** Silent success state on save (1.2s highlight on the created row, no toast).
- [ ] **E7-S3** Responsive behavior per the general rule in `03-screens.md` (drawer < 1024px, single column + fixed action bar < 768px, targets ≥ 44px).
- [ ] **E7-S4** Accessibility: visible focus (`outline: 2px solid var(--accent)`) on everything interactive, contrast ≥ 4.5:1 (never pure `--accent` on small text).
- [ ] **E7-S5** Categories and settings (`1aa`): category table, recommended card utilization, months of projection, hide amounts, financial month start day (with the R5 warning).
- [ ] **E7-S6** Full Playwright suite for the 10 flows in `05 § End-to-end flows`.
- [ ] **E7-S7** Non-functional: dashboard < 500ms with ~6,000 transactions (index on `(userId, competenceDate)`), final audit confirming zero `Float` in financial code.
- [ ] **E7-S8** Operations README: backup (daily `pg_dump`), restore, deploy via Docker Compose.

**DoD**: `pnpm test`, `pnpm build`, full Playwright suite, `05` checklist 100% checked.

---

## Out of scope (don't implement without an explicit request)

OFX/CSV import, Open Finance, multi-user (schema ready, UI isn't), native mobile app, push notifications, export for an accountant, debt/loan tracking, currency exchange, automatic investment return calculation (D6), auto-baked-in 13th salary (D3). See `07-open-decisions.md § Out of scope` for the full list and the reasoning behind each one.

## Known design debts (ask before improvising)

Mobile has no dedicated mockup for critical screens, the onboarding flow has no step-by-step mockup, standalone investment detail has no mockup, global search has no results screen, side-by-side two-month comparison hasn't been designed. If any of these blocks a story above, ask before deciding on your own (per the rule in `PROMPT.md`).
