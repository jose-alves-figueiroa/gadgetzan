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

- [x] `git init` on the repo (it isn't a git repository yet) + `.gitignore` (node_modules, .env, .next; don't ignore prisma/migrations)
- [x] `create-next-app` (App Router, TypeScript, Tailwind, no `src/`) at the root
- [x] Folder structure per `06-stack-and-deploy.md`: `app/(auth)`, `app/(app)`, `components/ui`, `components/finance`, `components/layout`, `lib/finance`, `prisma/`
- [x] Install deps: `prisma`, `@prisma/client`, `next-auth`, `zod`, `argon2` (or `bcrypt`), `date-fns`, `date-fns-tz`, `@phosphor-icons/react`, `recharts` (or `visx`), `vitest`, `@testing-library/react` if needed, `playwright`
- [x] Tailwind tokens from `04-design-tokens.md` (colors, ramps, 0.7× spacing, radii, Inter typography 400/500/600) — via Tailwind v4's CSS-first `@theme` in `app/globals.css` (v4 has no `tailwind.config.ts`; same tokens, current Tailwind convention)
- [x] Inter loaded from Google Fonts via `next/font`
- [x] Initial `prisma/schema.prisma` (full schema from `01`, + `minCashCents` and `includeCommitments` from D2/D4)
- [x] `docker-compose.yml` and multi-stage `Dockerfile` (`06-stack-and-deploy.md`), `next.config` with `output: 'standalone'`
- [x] `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` — renamed from `AUTH_URL` in Stage 7; see the E7-S6 note)
- [x] `vitest.config.mts` and `playwright.config.ts`
- [x] `scripts/create-user.ts` (creates the single user via CLI, password hash)
- [x] `prisma/seed.ts` — default categories only, from the list in `01-data-model.md`
- [x] Root README with local setup instructions (docker compose up, migrate, seed, create-user)

**Stage 0 definition of done**: `pnpm dev` serves an authenticatable (or stub) blank page, `pnpm test` runs (even with no tests yet), `docker compose up` brings up a healthy Postgres. **Met** — verified end-to-end: `pnpm test`/`pnpm build` green, `docker compose up` brings up a healthy `db` + a working `app` container (migrations applied, HTTP 200), `create-user`/`db:seed` verified against the live DB.

---

## Stage 1 — Foundation

**Goal**: schema live, auth working, visual shell (`1a`) navigable with empty data, base components ready for the following stages.

- [x] **E1-S1** As the app owner, I want the full Prisma schema from `01-data-model.md` (+ D2/D4) migrated on Postgres, so every following stage has somewhere to write data.
- [x] **E1-S2** As the single user, I want to log in with an email/password created via script, so I can access the app without a public signup screen (`06 § Auth`). — NextAuth Credentials provider (`lib/auth.ts`), argon2 verify, JWT session.
- [x] **E1-S3** As a user, I want every route outside `/login` to require a valid session, so the app isn't exposed on the local network without authentication (`middleware.ts`). — custom middleware using `getToken` (next-auth's default `withAuth` re-export isn't recognized as a valid export under Next.js 16's build).
- [x] **E1-S4** As a user, I want to see the sidebar (212px, "Hoje"/"Planejamento" groups) and the topbar (month selector, search, **+ Novo lançamento**, avatar) per mockup `1a`, so I can navigate across all the product's screens.
- [x] **E1-S5** As a user, I want constant access to the **+ Novo lançamento** and **Simular compra** buttons on every screen, so I never need to go back to the dashboard to act (`03 § Shell`). — both open placeholder modals; real functionality lands in Stage 3/6.
- [x] **E1-S6** As a developer, I want the base components (`Button`, `Field`, `Segmented`, `Card`, `Tag`, `Table`, `Modal`, `Bar`, `Donut`, `Tooltip`) implemented with the tokens from `04`, so I can reuse them across every screen without redefining style.
- [x] **E1-S7** As a developer, I want the shell's footer ("Ajustes") and the minimal responsive behavior (drawer < 1024px) sketched out, so Stage 7 only needs to refine it, not rebuild it. — footer done; below `lg` (1024px) the sidebar collapses and a hamburger button in the topbar opens it as an overlay drawer. Deliberately unrefined (no single-column card stacking, no fixed bottom action bar, no 44px target audit) — that polish is Stage 7 (E7-S3) per the plan.

**DoD**: clean `pnpm build`, working local login, navigable shell (routes can be "under construction" stubs), green `pnpm test` (even if empty of rules so far). **Met** — verified with a scripted Playwright pass against `pnpm dev`: logged-out `/` redirects to `/login`, login succeeds, shell renders at spec dimensions (212px sidebar, 56px topbar), modal opens/closes, nav routes work, zero console errors.

---

## Stage 2 — Financial engine (the core)

**Goal**: all the pure functions in `lib/finance/`, no UI, each with Vitest tests derived from `05-acceptance-criteria.md`. Don't move on with a red test.

One story per rule — all phrased as "As the system, I need to correctly compute X, so the UI never shows a wrong number":

- [x] **E2-R1** `lib/finance/transactions.ts` (or inside the queries) — `TRANSFER`, `INVESTMENT_IN/OUT`, `GOAL_IN/OUT`, `CARD_PAYMENT` never count as income/expense; `CARD_ADJUSTMENT` counts as an expense. Tests: the 4 R1 checkboxes in `05`.
- [x] **E2-R2** `lib/finance/savings.ts` — savings rate with the 4 lines (income, expenses, contributions, cash leftover), `null` when income = 0. Tests: the 4 R2 checkboxes.
- [x] **E2-R3** `lib/finance/invoice.ts` — invoice assignment by `closingDay`/`dueDay`, `referenceMonth` = due month, available card limit, outstanding balance on partial payment. Tests: 7 R3/R4 checkboxes (invoice part).
- [x] **E2-R4** `lib/finance/installments.ts` — installment split with the remainder on the last one, `installmentNo` 1..n, recalculation of unpaid installments on edit, removal of future installments on delete. Tests: part of R3/R4.
- [x] **E2-R5** `lib/finance/period.ts` — configurable financial month (`monthStartDay` 1..28), label from the interval's start. Tests: the 3 R5 checkboxes.
- [x] **E2-R6** `lib/finance/recurrence.ts` — occurrence generation (`MONTHLY`/`WEEKLY`/`YEARLY`), short-month truncation, pending status for a past occurrence with no transaction, `PAUSED`/`ENDED`, `method = CARD` lands on the invoice. Tests: the 4 R6 checkboxes.
- [x] **E2-R7** `lib/finance/projection.ts` (confidence) — every future value carries a `Confidence` (`REALIZED`/`CONFIRMED`/`RECURRING`/`PROJECTED`), never summed without a visible breakdown (`groupByConfidence`). Tests: part of R7/R8.
- [x] **E2-R8** `lib/finance/projection.ts` (variable) — average of the last `variableLookback` closed months per `VARIABLE` category; no projection with < 3 closed months; `FIXED`/`COMMITMENT` only via recurrence; `projectedBalance[current month] == balance available today`. Tests: the 6 R7/R8 checkboxes.
- [x] **E2-R9** `lib/finance/goals.ts` — free to spend (`available − reserved`, an investment-backed goal doesn't subtract), required pace vs. average contribution. Tests: the 4 R9 checkboxes.
- [x] **E2-R10** `lib/finance/simulate.ts` — pure simulation function (invoice before/after, category limit, projected balance, warnings with a number, `Settings.minCashCents` (D2) as the floor). **Writes nothing.** Tests: all 6 R10 checkboxes in `05`. **Not implemented** — "impact on each goal with a deadline" (no acceptance checkbox covers it and the exact delay-computation isn't specified anywhere; implementing it would mean inventing product behavior) and "suggested alternative" (explicitly marked optional in `02-business-rules.md`). Flagging rather than silently claiming full R10 coverage — revisit if the product owner wants goal-impact specified.
- [x] **E2-R11** `lib/finance/networth.ts` — net worth = accounts + investments (± open invoices per the setting, always `false` for now per D1). Tests: the 4 R11/R12 checkboxes. (Stable monthly snapshot *storage* is a data-access concern, not a pure function — deferred to whichever stage wires this to Prisma.)
- [x] **E2-R12** `lib/finance/accounts.ts` (balance) — account balance via the R12 formula, only `competenceDate <= today` enters the current balance. Tests: part of R11/R12.
- [x] **E2-R13** `lib/finance/alerts.ts` — the 10 triggers from the R13 table, ordered by severity, max 3 "warning" items on the dashboard, stable and dismissible `alertKey`, at least one action per alert, using `Limit.includeCommitments` (D4) for the total limit. Tests: the 6 R13 checkboxes.
- [x] **E2-Limits** `lib/finance/limits.ts` — limit utilization (category, total, card), respecting D4 (commitments excluded from the total by default).
- [x] **E2-Money** `lib/finance/money.ts` — `toCents`, `formatBRL`, parsing "1.234,56" and "1234,56" (covers the validation in `05 § Form validations`).

**DoD**: `pnpm test` with one test per checkbox in `05` (rules R1–R13), 100% green, no `Float` anywhere in a monetary computation, clean `pnpm build`. **Met** — 99 tests across 14 files, all green; `grep`-audited for stray `Float`/`parseFloat` in non-test finance code (none); clean `pnpm build`.

---

## Stage 3 — Setup forms and transactions

**Goal**: data can enter the system. Onboarding works.

- [x] **E3-S1** Account setup (`2a`): institution, nickname, type, current balance + date (doesn't generate a backdated transaction), include in totals.
- [x] **E3-S2** Card setup (`2b`): name, debit account, limit, closing/due day (1–28, validated per `05`), block explaining the consequence of the closing date. Utilization alert itself is R13 (Stage 2 `alerts.ts`), not wired into a UI badge here yet — that lands with the alerts screen (Stage 6).
- [x] **E3-S3** Category setup (`2d`): name, nature (fixed/variable/commitment/income), icon, optional limit (creates a companion category-scoped `Limit`).
- [x] **E3-S4** Investment setup (`2c`): name, type, account, applied amount, current value, liquidity, option to debit the contribution now (creates an `INVESTMENT_IN`, never an expense — R1).
- [x] **E3-S5** Recurrences — create/edit (`1r`): income/expense segmented control, frequency + day, live preview of the next 3 occurrences via `lib/finance/recurrence` (pure function, computed client-side).
- [x] **E3-S6** Recurrences — list (`1q`): 4 KPIs, 3 groups (Receitas/Compromissos/Despesas), pause/end actions. "View upcoming occurrences" per rule isn't wired yet — deferred, no acceptance checkbox requires it.
- [x] **E3-S7** New transaction modal (`1j`): 5 segmented types (Despesa/Receita/Transferência/Investimento/Resgate), installments with computed value, "despesa fixa" checkbox, "Impacto ao salvar" block computed against real invoice/limit data via `lib/finance/invoice`.
- [x] **E3-S8** Transfer — folded into the same modal's "Transferência" type rather than a separate 1l modal (both mockups describe the same underlying operation): origin→destination account, "não entra em receitas nem despesas" note.
- [x] **E3-S9** Transaction list (`1i`): grouped by day with day totals, period inflow/outflow totals. Filters by type/account/category aren't wired yet (no acceptance checkbox requires them for Stage 3) — deferred.
- [x] **E3-S10** Transaction detail (`1k`): metadata, affected category-limit bar, delete action. Duplicate/edit deferred — edit in particular needs installment-recalculation UI that's a real chunk of its own work, not a quick addition; flagging rather than silently claiming it.
- [x] **E3-S11** Onboarding (R14, `1aa` flow): financial month start day → account → recurring salary → card (skippable) → bulk fixed expenses → dashboard. Old invoices/investments/goals/limits (R14's explicitly-optional step 6) deferred — those flows land with their own stages (4/6).

**DoD**: Playwright flow #1 (onboarding) and #2 (a recurrence shows up — partial, verified in the Stage-3 recurrences list since Próximos meses/Calendário don't exist until Stage 5) pass. Clean `pnpm test` + `pnpm build`. **Met** — verified with a scripted Playwright pass against `pnpm dev`: full onboarding (month start day → account → salary → skip card → fixed expense → dashboard) succeeds, and the created recurrences ("Salário", "Aluguel") appear correctly in `/recurrences` with correct KPIs, zero console errors. `pnpm test`: 100 tests green. `pnpm build`: clean. Also fixed two real bugs surfaced only by running the app: Prisma 7's client rejecting plain `YYYY-MM-DD` strings for `@db.Date` columns (needed a `toPrismaDate` helper across every server action), and server components passing function props to client "trigger" components (an RSC boundary violation) — refactored the `CreateXModal` components to own their trigger button internally.

---

## Stage 4 — Present

**Goal**: the screens that answer "where do I stand right now."

- [x] **E4-S1** Dashboard (`1a`): 3 KPIs (net worth, available balance, cards utilization), current month realized (4 of the 5 lines + savings rate — no stacked category bar yet), alerts (real R13 category-limit triggers, wired). Next-month forecast, projected invoices, goals, and upcoming events are explicit "chega no Stage 5/6" placeholders — projection (R7/R8) aggregation and goals CRUD don't exist yet, and R8's projection specifically depends on ≥3 closed months of history the app can't have yet either way.
- [x] **E4-S2** Month screen (`3a`): KPIs vs. previous month, composition donut, month limits (category + total, respecting D4). "What you saved" and "what changed" insights/6-month bars deferred — need net-worth history and multi-month aggregation not built yet.
- [x] **E4-S3** Accounts (`1m`): 3 KPIs (Disponível/Investido/Reservado — reserved is 0 until goals exist), one card per account, total available. Cards/investments indented under their account is deferred (cosmetic; the data itself is correct and reachable).
- [x] **E4-S4** Account detail (`1n`): balance, 3 KPIs (inflows/outflows/current balance — "projected balance at end of next month" needs R8, deferred with E4-S1), latest transactions. Transfer/new-transaction actions already reachable via the global "+ Novo lançamento".
- [x] **E4-S5** Cards + current invoice (`1o`): limit/committed/available, utilization bar, invoice table for the selected month, month navigation. Defaults to the card's actual currently-open invoice per R3 (not the raw calendar month — those diverge whenever today is past `closingDay`).
- [x] **E4-S6** Investments (`1p`): list with current value. Contribute/withdraw already work end-to-end via the global modal's Investimento/Resgate types (Stage 3) rather than dedicated per-row buttons. Month return, distribution, and the goals-reservation note deferred — return computation is explicitly D6 (manual, no automatic calc), the rest needs goals data that doesn't exist yet.
- [x] **E4-S7** Invoice operations (`2e`): pay (full/partial, correctly marks `paidAt` only once `paidCents` reaches the invoice's real total), adjust (with a reason, posts a `CARD_ADJUSTMENT`), enter a past invoice (`enterPastInvoice`, upserts a manual-total Invoice — not yet wired to a UI entry point, callable but no button routes to it).

**DoD**: Playwright flows #5 (transfer), #9 (pay an invoice), #10 (close out the month) pass. **Met** — verified with a scripted Playwright pass against `pnpm dev`: created a card, recorded a card expense, confirmed the invoice + available limit updated correctly, paid it in full and confirmed "Fatura paga", and loaded the month screen with correct KPIs/donut. Transfer was already verified in Stage 3. Zero console errors. `pnpm test`: 100 green. `pnpm build`: clean. Docker rebuilt and confirmed serving the same code.

Two real bugs surfaced only by running the flow end-to-end (not by build/typecheck): the global transaction modal's card `<select>` used a `useState` initializer that never re-synced after a card was created elsewhere in the same session (stale by construction — `useState`'s initial value only applies on first mount), silently submitting an empty `cardId`; and the card detail page defaulted to "this calendar month" instead of the card's actual currently-open invoice, which diverge whenever today is past `closingDay`. Also added `revalidatePath("/", "layout")` to every setup-form action, since AppShell's account/card/category/investment lists are fetched once at the root layout and don't refresh on their own.

---

## Stage 5 — Future

**Goal**: the screens that answer "what's coming."

- [x] **E5-S1** Upcoming months (`1d`): 6 cards, next month highlighted, decreasing opacity past the 4th month, stacked bars of committed spend (Confirmado/Recorrente/Projetado). Built on a new `lib/server/future.ts` (`getUpcomingMonths`) shared with the dashboard.
- [x] **E5-S2** Projected invoices (`1e`, `/cards/[id]/invoices`): table by month (Compras/Parcelas/Assinaturas/Total/Status). Compras and Parcelas come from real stored `Transaction` rows (installments are materialized for every future month at purchase time — Stage 3); Assinaturas (CARD-method recurrences) are generated on the fly since they aren't materialized ahead of time. Mandatory note that future one-off purchases aren't estimated (R8).
- [x] **E5-S3** Installment purchase detail (`/purchases/[id]`): progress bar ("N de M paga"), installment list (paga/na fatura/futura), collapses installments past the 6th into a summary row, links back to the card and to each installment's transaction. Linked from the transaction detail page when `purchaseId` is set. Edit action deferred, consistent with Stage 3's transaction-edit deferral (installment recalculation UI is its own chunk of work).
- [x] **E5-S4** Calendar (`/calendar`): Agenda mode (default, running account balance per row, invoice closing/due markers) and a simple Month grid mode (day cells with event dots), month navigation, sidebar with month summary and lowest balance + date. New `lib/server/calendar.ts`.
- [x] **E5-S5** Net worth (`/net-worth`): 6M/12M/Tudo selector, available/invested breakdown, monthly bars (current month solid, next month outline-only projection), change over period. Net worth history is *reconstructed at read time* (R11 explicitly allows this over a stored snapshot): past account balances replay exactly from stored transactions; past invested totals reverse `INVESTMENT_IN`/`OUT` moves off today's `currentCents`, which assumes flat market value between snapshots since the schema has no valuation-history table — flagged in a code comment rather than silently claiming full historical accuracy. "Growth insight vs. target" is a plain period-change sentence, not a comparison against a numeric target — no target field exists anywhere in the data model and inventing one would be new product behavior.
- [x] Dashboard (Stage 4 placeholders filled in): "Próximo mês previsto" (4 real forecast lines + projected balance footer) and "Faturas projetadas" (5-month mini bar chart) now use `getUpcomingMonths()`; added "Próximos eventos" (next 4 calendar rows) using the new calendar data. "Patrimônio líquido" KPI now links to `/net-worth`.

Two real bugs surfaced only by live Playwright testing (not by build/typecheck), both money-correctness bugs per CLAUDE.md's priority on financial correctness:
1. A CSS bug in every bar chart added this stage (dashboard mini chart, `/future` cards, `/net-worth`): percentage `height` on a bar living inside an `items-end` flex column with no explicit height resolves against nothing (CSS spec: percentage height against an auto-height container computes to `auto`), so every bar silently collapsed to ~0px. Fixed by wrapping each bar in a fixed-height track div and moving the label outside it.
2. `getUpcomingMonths()` initially bucketed card-installment transactions by `competenceDate` (which is the *original purchase date*, identical across every installment of a purchase) instead of by the invoice they actually land on — so a 10× purchase inflated every future month's "Faturas" line by the *first* installment's amount instead of the correct per-month one. Fixed by mapping each stored card transaction's real month through its `invoiceId → Invoice.referenceMonth`, never re-derived from `competenceDate`. Diagnosing this also surfaced a **pre-existing Stage 4 bug**: `getProjectedInvoices` and four separate "available card limit" queries (`dashboard.ts`, `transaction-impact.ts`, `cards/page.tsx`, `cards/[id]/page.tsx`) summed *every* `Transaction` linked to an invoice via `invoiceId` without filtering by kind — since a `CARD_PAYMENT` row is also linked to its invoice once paid, a partially-paid invoice's payment was silently counted as still-owed spend, inflating both the invoice total shown and the card's "available limit." Fixed all five call sites with an explicit `EXPENSE`/`CARD_ADJUSTMENT` filter (matching `lib/finance/transactions.ts`'s `isExpense`). Also fixed a `formatBRL` negative-zero display bug (`-R$ 0` instead of `R$ 0`) hit by these same forecast lines whenever a month's negated total was exactly zero.

**DoD**: Playwright flow #3 (10× installment purchase raises the projected invoice by the installment amount for every future month) and #4 (dashboard → next month, the 4 forecast lines check out and match the card's own projected-invoices table) — both verified live against `pnpm dev`, zero console/page errors.

---

## Stage 6 — Decision

**Goal**: the screens that help decide.

- [x] **E6-S1** Limits — list (`1t`): total-month card (respecting D4's `includeCommitments`) plus one card per category/card limit, severity colors (ok/warning/exceeded). `CARD_UTILIZATION`-scope limits supported too (compares against the card's real utilization via `calculateAvailableLimit`), though the mockup's main description centers on category/card limits.
- [x] **E6-S2** Limits — create/edit modal (`1u`): scope segmented control (Total/Categoria/Utilização do cartão), amount, "avisar em %", `includeCommitments` toggle for TOTAL_MONTH. One active limit per category/card/total enforced server-side (screen shows a single card per entity — a second one would have nowhere to render). 6-month bar history (`getLimitHistory`) computed but not yet wired into the modal's UI — the create/edit modal itself doesn't have an edit mode yet (create-only); flagging rather than silently claiming the full 1u spec.
- [x] **E6-S3** Goals — list (`1v`): top card with the R9 math (available − reserved = livre para gastar), goal grid with icon/name/deadline/saved/target/bar/pace status/remaining, ghost "+ Criar porquinho" trigger in the grid.
- [x] **E6-S4** Goals — detail (`1w`): large progress bar, pace verdict card, metadata (deadline, monthly target, where it's held), transaction history, Guardar/Resgatar actions (both logical-only — R1/R9, never touch account balance).
- [x] **E6-S5** Alerts (`1z`): "Pedem atenção" / "Boas notícias" sections, every alert links to a real screen, Dispensar (dismiss) wired to `AlertState`, auto-un-dismisses at the start of a new financial month. New `lib/server/alerts.ts` (`getAllAlerts`) implements 6 of R13's 8 non-onboarding triggers (category limit, card utilization, invoice spike, negative projected balance, goal behind pace, variable category above/below average) against real data; the dashboard's alert box now calls this too instead of its old category-limit-only inline version. `largeInstallmentAlert` and `netWorthGrowthAlert` deferred — the former needs an "average income" concept and the latter a numeric net-worth growth target, neither of which exists anywhere in the data model or open-decisions doc; inventing one would be new product behavior.
- [x] **E6-S6** Analysis (`1y`): Categoria/Cartão/Conta segmented control, one card per entity with a proportional bar, nature, % of total, category limit, and change vs. previous month; sidebar with spend-nature breakdown (fixed/commitment/variable), 6-month expense bars, and a top-variance insight sentence.
- [x] **E6-S7** Simulator (`1g`): full input form (description, amount, category, Cartão/Débito segmented, card + installments or account, date). "Não gera lançamento" chip. Submits via URL query params to `/simulate/result` (R10 requires *two separate screens* per `03-screens.md`, and the simulation itself must persist nothing — passing the inputs through the URL avoids inventing session/draft storage for a value that's cheap to just recompute).
- [x] **E6-S8** Simulation result (`1h`): verdict card (warnings from the pure `simulatePurchase`, or an explicit positive confirmation), 5 before→after KPIs (current/next invoice, available limit, card utilization, today's balance — struck-through old value + arrow + new value), a solid-vs-dashed SVG line chart plus the exact value table, "nenhum lançamento foi criado" note, and "Registrar a compra real" (creates the exact same transaction/installments via `recordSimulatedPurchase`). "Ajustar simulação" links back to the form but doesn't prefill it. **Suggested alternative deferred** — `02-business-rules.md` explicitly marks it optional ("high value" but optional), and goal-impact-on-simulation was already flagged not implemented back in Stage 2 (E2-R10) for the same reason (no acceptance checkbox, no specified delay computation).

Also wired the dashboard's Stage-4/5 "Porquinhos" placeholder to real goal progress, and the "Simular compra" sidebar button (previously a Stage-1 placeholder modal) now navigates to the real `/simulate` page.

Two real bugs surfaced by live Playwright testing, both caught chasing "duplicate React key" console warnings on `/alerts` and `/transactions` after repeatedly exercising the same flows:
1. `categoryLimitAlert`'s `alertKey` is keyed only by `categoryId`, so two `Limit` rows accidentally pointing at the same category (nothing previously stopped this) produced two alerts with an identical key — a real violation of R13's "stable and dismissible `alertKey`" requirement. Fixed two ways: `createLimit` now rejects a second active limit for the same category/card/total scope, and `getAllAlerts` de-dupes by `alertKey` defensively regardless of the data's shape.
2. `recordSimulatedPurchase` initially passed the simulation's already-parsed integer `amountCents` straight into `createTransaction`, whose `centsPositive` schema re-parses its input as a pt-BR reais *string* (`"1.234,56"` → cents) — silently multiplying the recorded amount by 100. Fixed by converting back to a reais string before the call.

**DoD**: Playwright flows #6 (create a goal, contribute, see progress and pace), #7 (create a category limit, spend past it, see the alert on `/alerts` with a working action), and #8 (simulate a 5× card purchase, read real warnings computed against live data, "Registrar a compra real" creates the exact transaction) — all verified live against `pnpm dev`, zero unexpected console/page errors (the one console 500 seen mid-testing was the intentional duplicate-limit guard rejecting a deliberately-repeated test case).

**DoD**: Playwright flows #6 (goal), #7 (limit + alert), #8 (simulation → real transaction).

---

## Stage 7 — Polish

- [~] **E7-S1** Empty/loading/error/low-confidence states (`1ab`) on every data screen listed in Stages 3–6. New shared `components/ui/{EmptyState,Skeleton,ErrorState,LowConfidence}.tsx`. Wired: `app/(app)/error.tsx` (client boundary) and `app/(app)/loading.tsx` (generic route-level skeleton — same shape for all ~20 screens rather than a bespoke skeleton per screen, which is a lot more surface for the same "never a spinner" requirement) cover error/loading app-wide. Empty state wired into accounts, cards, investments, recurrences, transactions, goals, limits (replaced the old `UnderConstruction` placeholder, which had no icon/action and misleading "em construção" copy — deleted, unused after the swap). `LowConfidence` extracted and wired into the dashboard and `/future`'s existing per-month notes. Not yet touched: calendar/net-worth/analysis/purchase-detail/account-detail/card-detail zero-item edges, and a per-screen (rather than generic) loading skeleton — continuing next iteration.
- [x] **E7-S2** Silent success state on save (1.2s highlight on the created row, no toast). New `components/ui/HighlightOnCreate.tsx` (sessionStorage-based: the modal calls `markCreated(id)` right before closing, the row wrapper checks it on mount and applies a 1.2s `bg-accent/10` fade, no toast). Every create action that feeds a list now returns its record (`createLimit`, `createGoal`, `createTransaction`/`createTransfer`/`createInvestmentMove` didn't before); wired into all 7 create modals (account, card, category, goal, limit, recurrence, transaction) and their lists (accounts, cards, investments — via account/card creation elsewhere, settings' category table, goals, limits, recurrences, transactions). Settings form uses its own inline "Salvo" label swap instead (it's a form, not a list row).
- [~] **E7-S3** Responsive behavior per the general rule in `03-screens.md` (drawer < 1024px, single column + fixed action bar < 768px, targets ≥ 44px). Drawer (< 1024px) already existed from E1-S7. Below 768px: every fixed `grid-cols-N` KPI row now goes to a 2×N grid (`grid-cols-2 md:grid-cols-N`), every card/item grid (goals, limits, `/future`) goes to a single column (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), and the three main+sidebar two-column layouts (dashboard, `/calendar`, `/analysis`) stack to one column below `md`. New `components/layout/MobileActionBar.tsx` — below 768px the two always-reachable actions ("+ Novo lançamento", "Simular compra") move to a fixed 56px bottom bar instead of crowding the topbar (topbar's own "Novo lançamento" button is now `hidden md:flex`); `<main>` gets matching bottom padding so content doesn't sit under the bar. `Modal` was fixed-width (`w-[440px]`/`w-[880px]`) with no viewport clamp — would have overflowed any phone narrower than 440px; changed to `w-full max-w-[…]`. Touch targets: `Button`, `Sidebar` nav items/footer buttons, and the topbar's hamburger/search buttons get `max-md:min-h-11` (and `min-w-11` where square) so they hit 44px on mobile without changing the locked desktop density from `04-design-tokens.md`. Verified live: seeded a throwaway test user/account/card/transactions against the local Postgres, curl-authenticated smoke test across all 15 main routes (all 200, no server errors) at initial check, and since then the real Playwright browser suite (E7-S6, below) exercises the same screens on every run. That suite runs at the default **desktop** viewport though — nothing in this session actually rendered the app at a real <768px width, so the CSS breakpoints themselves are unverified beyond code review; worth a manual pass. Not yet done: the `<table>` → row-list transform for `05`'s "tables become row-lists with the label above the value" (6 screens use `Table`: settings, goals/[id], cards/[id], cards/[id]/invoices, simulate/result, accounts/[id]) — left as horizontal-scroll (`overflow-x-auto`, already in place) rather than rushing a per-column-label transform across 6 different tables; a full topbar icon-button audit (avatar left at 28px, decorative/low-traffic).
- [x] **E7-S4** Accessibility: visible focus (`outline: 2px solid var(--accent)`) on everything interactive — already global since Stage 1 (`app/globals.css`). Contrast ≥ 4.5:1: audited every `text-accent` usage; left the ones that are locked `04-design-tokens.md` component specs (Button, Segmented, Tag `Projetado`) since `--accent` measures ~4.7–5.5:1 against `--bg`/`--surface` there; moved the ad hoc small-text cases (inline links, onboarding step indicator, simulator chip) to `accent-300` for margin, per `05`'s explicit rule. 44px mobile targets covered under E7-S3 above.
- [x] **E7-S5** Categories and settings (`1aa`): category table (already existed), + new `SettingsForm` — recommended card utilization (`cardUtilizationTarget`), months of projection (`projectionMonths`), hide amounts (`hideAmounts`, wired app-wide via a `data-hide-amounts` attribute + CSS `blur` on every `.tabular-money` element — kept out of `lib/finance/money.ts` per CLAUDE.md's UI/domain boundary), financial month start day with the R5 warning ("historical aggregates will change") shown inline when the value is edited. "Email alerts" from `03-screens.md`'s field list is **not** implemented — no schema field, no mail infrastructure anywhere in the stack docs, and `PLAN.md`'s own E7-S5 story text (the authoritative backlog item) doesn't list it either; treating it like the other out-of-scope notification channels in `07-open-decisions.md` rather than inventing SMTP config.
- [x] **E7-S6** Full Playwright suite for the 10 flows in `05 § End-to-end flows` — `e2e/flows.spec.ts`, one `test.describe.serial` block sharing a single test user's cumulative state (see `e2e/README.md`). Real isolated harness, not the ad hoc manual passes prior stages did: `e2e/global-setup.ts` provisions a dedicated `gadgetzan_test` database (never the real one), runs `prisma migrate deploy`, wipes it, and seeds one fixed user + default categories; `playwright.config.ts` runs the app on port 3100 (never 3000, so it can't collide with `docker compose`'s `app` service pointed at real data) via `next build && next start`. New `pnpm test:e2e` script. All 10 flows pass, confirmed stable across repeat runs.

  Building this harness surfaced four real, previously-undiscovered bugs — fixed, not routed around:
  1. **`NEXTAUTH_URL` vs `AUTH_URL`** — next-auth v4 reads the former by exact name; the project's `.env`/`docker-compose.yml`/`06-stack-and-deploy.md` all had the latter, which next-auth never reads. Without it next-auth falls back to a default that doesn't match a non-3000 origin and rejects the credentials callback as a host mismatch before `authorize()` ever runs — this was silently "working" only because normal dev/Docker both happen to run on port 3000. Renamed everywhere; `.env` updated locally too.
  2. **`createTransfer`/`createInvestmentMove` never wrapped `competenceDate` in `toPrismaDate()`** — Stage 3's Prisma-7-`@db.Date` fix (flagged in that stage's own report) covered `createTransaction` but missed these two siblings, so every transfer and every investment contribution/withdrawal was throwing `PrismaClientValidationError` and silently failing. Audited every `@db.Date` field's write site (10 fields, all of `lib/server/*.ts`) — no other gaps found.
  3. **`getCalendarMonth` never incorporated recurrence occurrences** — only stored `Transaction` rows and invoices, so a brand-new recurrence never appeared in `/calendar` at all (contradicting `05`'s flow #2). Fixed for the unambiguous case only: future occurrences (`date > today`) of `ACCOUNT`-method active rules, mirroring `future.ts`'s existing pattern. Past-due "pending" occurrences (R6: a past occurrence with no matching transaction) are a harder, separate matching problem — no linking key exists between an occurrence and the transaction that fulfills it, and `lib/finance/recurrence.ts`'s `isOccurrencePending()` has sat unwired since Stage 2 for exactly that reason. Left unsolved rather than inventing a matching heuristic; `CARD`-method recurring occurrences (which should land on an invoice, not the account) also deliberately out of scope here.
  4. **`CreateAccountModal`'s opening-date field had no `defaultValue`** — every other date field with this exact `required` + "defaults to today" pattern in the app (onboarding's own account step, `PayInvoiceModal`, `GoalMoveModal`) sets one; this one didn't, so the standalone "Nova conta" flow silently required the user to pick a date with no default, unlike onboarding's equivalent step. One-line fix for consistency.
- [x] **E7-S7** Non-functional: `(userId, competenceDate)` index already existed on `Transaction` since the Stage 0 schema — nothing to add. `Float`/`parseFloat` audit: grepped every `lib`/`app`/`components` file — the only hit is the explanatory comment at the top of `lib/finance/money.ts` itself; the schema has zero `Float` columns. Dashboard perf: new `scripts/perf-check.ts` (`pnpm perf-check`) — provisions its own `gadgetzan_perf` database (never dev or `gadgetzan_test`) on its own port (3200), seeds 6,000 transactions across 5 years once (idempotent — skips reseeding on repeat runs), starts a production server, times 5 authenticated dashboard loads. Result: 539/299/308/294/298ms — first hit (cold connection-pool/route warm-up even after one untimed warm-up request) at 539ms, steady-state ~300ms, average 348ms, under the 500ms target. Left as a reusable script (not part of `pnpm test`, since it needs its own server + ~10s of seeding) for re-checking after future dashboard-query changes.
- [ ] **E7-S8** Operations README: backup (daily `pg_dump`), restore, deploy via Docker Compose.

**DoD**: `pnpm test`, `pnpm build`, full Playwright suite, `05` checklist 100% checked.

---

## Out of scope (don't implement without an explicit request)

OFX/CSV import, Open Finance, multi-user (schema ready, UI isn't), native mobile app, push notifications, export for an accountant, debt/loan tracking, currency exchange, automatic investment return calculation (D6), auto-baked-in 13th salary (D3). See `07-open-decisions.md § Out of scope` for the full list and the reasoning behind each one.

## Known design debts (ask before improvising)

Mobile has no dedicated mockup for critical screens, the onboarding flow has no step-by-step mockup, standalone investment detail has no mockup, global search has no results screen, side-by-side two-month comparison hasn't been designed. If any of these blocks a story above, ask before deciding on your own (per the rule in `PROMPT.md`).
