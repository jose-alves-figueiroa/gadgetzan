# 03 — Screens

Each screen points to its mockup id in `design/Financas - Telas.dc.html` (the visible tag in the corner of each screen; `#1a` in the URL of the file opened in the browser jumps to it).

*Note: quoted labels, column headers, tags, and button text below are the actual app copy and stay in pt-BR — that's what ships to the user. See `04-design-tokens.md § Copy` for the full terminology list.*

## App shell — mockup `1a`

Desktop layout, working width 1280px+:

- **212px sidebar**, `--bg` background, hairline right border. Brand at the top (18px accent square + "Gadgetzan", 15px/500).
- Nav groups with a 9.5px/500 header, `letter-spacing .14em`, uppercase, `#595d6c` color:
  - **Hoje** ("Today"): Dashboard, Mês, Lançamentos, Contas, Cartões, Investimentos, Porquinhos
  - **Planejamento** ("Planning"): Próximos meses, Calendário, Recorrências, Limites, Análise
- Nav item: 12.5px, 15px Phosphor icon, `padding 6px 10px`, 6px radius. Active: `rgba(145,132,217,.14)` background, `#d2cefd` text, `inset 0 0 0 1px rgba(145,132,217,.35)`.
- Sidebar fixed footer: **Simular compra** button (accent outline, full width) + Ajustes.
- **56px topbar**: month selector (`‹ Agosto 2026 ›` in a hairline box), context chip, on the right Buscar, **+ Novo lançamento** (accent outline) and a 28px avatar.
- Content: `padding 22px`, `--surface` cards with 8px radius and `gap 14px`.

Two actions are always reachable, on any screen: **+ Novo lançamento** and **Simular compra**.

**Navigation alternatives evaluated** (don't drop without discussing): `1b` horizontal top bar with a dashboard mirroring current/next month; `1c` icon-only sidebar with a timeline dashboard. The implementation is based on `1a`.

**Responsive** (not mocked): below 1024px the sidebar collapses into a drawer; below 768px cards stack in a single column, KPIs go into a 2×N grid, tables become row-lists with the label above the value, and primary actions move to a fixed bottom bar (56px tall, targets ≥ 44px).

---

## 1. Dashboard — `/` — mockup `1a`

Answers "where do I stand right now and what does next month look like."

Vertical order (this is product hierarchy, not aesthetics):

1. **Three KPIs** in a 3×1 grid: Patrimônio líquido / net worth (29px, with a 6-month mini-chart and change vs. previous month), Saldo disponível / available balance (with a bar and the "Livre para gastar" / "Reservado em porquinhos" lines), Próxima fatura / next invoice (with closing date, due date, and utilization).
2. **Current month realized**: Receitas · Despesas · Aportes · Sobra em caixa · Taxa de poupança (5×1 grid, 21px). Below it, an 8px stacked bar of the category breakdown + legend with values.
3. `1fr 352px` grid:
   - Left: **Próximo mês previsto** / next month forecast (income, expenses, invoices, result + projected balance in the card footer) and **Faturas projetadas** / projected invoices (5 bars, solid realized vs. outlined projected).
   - Right: **Alertas** (max 3, R13), **Porquinhos** (2–3 with a bar and pace status), **Próximos eventos** (4 calendar rows).

States: no data → onboarding (R14); < 3 months → low-confidence projection blocks.

---

## 2. Month close-out — `/month/[month]` — mockup `3a`

The monthly-ritual screen. Order: month KPIs with comparison vs. previous month → **category composition donut** (168px ring, 100px hole, center shows total expenses) with a legend of values and % + fixed/commitment/variable footer → **month limits** (total + per category + card utilization, with status) → **what you saved** (contributions per goal + net worth) → **what changed this month** (insights with an action + last-6-months expense bars).

Month navigation in the header; the "Ver setembro" ("See September") action leads to Próximos meses.

---

## 3. Upcoming months — `/future` — mockup `1d`

6 month cards (6×1 grid) with income/expenses/invoices/result and projected balance; next month highlighted with an accent outline; months past the 4th get `opacity .72` and a confidence note. Below that, stacked bars of committed-spend composition (confirmed / recurring / projected) with a legend. Navigation by 6-month window.

---

## 4. Projected invoices — `/cards/[id]/invoices` — mockup `1e`

Table: Mês · Compras · Parcelas · Assinaturas · Total · Status (Realizado / Confirmado / Projetado tag). Mandatory note explaining that future one-off purchases aren't estimated (R8).

## 5. Installment purchase detail — `/purchases/[id]` — mockup `1f`

420px panel: total, n × value, card, date, progress bar ("1 de 10 paga" — "1 of 10 paid"), installment list with month and status (paid / on the invoice / future), grouping the distant ones into one row. Actions: view on invoice, edit (R4).

## 6. Simulator — `/simulate` — mockup `1g`

Form: description, amount, **category** (defines which limit to check against), payment method (Cartão/Débito/Pix segmented control), card, installments, when. Permanent "não gera lançamento" ("doesn't create a transaction") chip. CTA "Simular impacto".

## 7. Simulation result — `/simulate/result` — mockup `1h`

Verdict at the top (card with an accent outline, status icon, 2–3 sentences explaining **why**), 5 before→after KPIs (current invoice, next invoice, available limit, category limit, free to spend) with the old value struck through + arrow + new value, severity-colored bars. Below, `1fr 400px` grid: projected balance chart with vs. without the purchase (5 months, solid line vs. dashed + value table) and impact on goals + suggested alternative. Actions: adjust the simulation / record the real purchase (R10).

## 8. Transactions — `/transactions` — mockup `1i`

Filters: type segmented control (Tudo/Despesas/Receitas/Transferências/Investimentos), account chips, category, period; period totals on the right (inflows, outflows, balance). List grouped by day with a day header + day total. Row: category icon, description, `categoria · conta/cartão` subtitle, tags (Recorrente, 10× R$ 600, Transferência, Variável) and signed value.

## 9. New transaction — modal — mockup `1j`

5-type segmented control (Despesa/Receita/Transf./Invest./Resgate). Expense: description, amount, date, category, pay with (account or card), installments with the computed installment value, "despesa fixa" checkbox. **"Impacto ao salvar"** ("Impact on save") block with invoice before→after, monthly effect, and limit. Validations in `02` and `05`.

## 10. Transaction detail — `/transactions/[id]` — mockup `1k`

Header with icon + description + date/time, 32px value, metadata rows (category, paid with, invoice, type), affected category limit bar, note field, delete / duplicate / edit actions.

## 11. Transfer — modal — mockup `1l`

Origin→destination account card with an arrow, amount, date, "não entra em receitas nem despesas" note (R1) and a preview of both balances + unchanged total.

## 12. Accounts — `/accounts` — mockup `1m`

Three KPIs (Disponível, Investido, Reservado em porquinhos) and one card per account with linked cards and investments indented underneath. Footer with total available.

## 13. Account detail — `/accounts/[id]` — mockup `1n`

32px balance, transfer/new-transaction actions, 3 KPIs (inflows, outflows, projected balance at the end of next month), table of latest transactions with tags.

## 14. Cards + current invoice — `/cards` and `/cards/[id]` — mockup `1o`

Card component with limit/committed/available, utilization bar and target note. Below it, a month selector and the invoice table (date, description with recurring/installment tags, category, value) and total.

## 15. Investments — `/investments` — mockup `1p`

32px total invested + month return, mini-chart, distribution bar, table (asset, account, applied, current value, return %). Note on how much is reserved for goals. Aportar / Resgatar (contribute / withdraw) actions (R1).

## 16. Recurrences — `/recurrences` — mockup `1q`

Four KPIs (fixed income, fixed expenses, commitments, monthly fixed leftover). Three groups: **Receitas**, **Compromissos** (with a subtitle explaining the nature), **Despesas**. Row: icon, name, `frequência · dia · conta/cartão · categoria`, value/month, menu (edit, pause, end, view upcoming occurrences). Paused rows at `opacity .55` with a tag.

## 17. Create/edit recurrence — modal — mockup `1r`

Receita/Despesa segmented control, name, amount, frequency + day, account/card, category, end date, and a **preview of the next 3 occurrences** with a note that it will start appearing in projections (R6).

## 18. Calendar — `/calendar` — mockup `1s`

Agenda mode (default) and Month mode. Agenda: rows `dia · ícone · descrição + tag · valor · saldo corrente`, including invoice closing and due dates. Sidebar: month summary (in, out, end-of-month) and **lowest balance of the month** with the date — the number that prevents surprises.

## 19. Limits — `/limits` — mockup `1t`

Total monthly limit card (9px bar) and one card per category/card limit with a bar, values, %, and a context sentence (comparison with the average, days remaining). Colors: within = accent, ≥ warn = amber, exceeded = red.

## 20. Limit detail/creation — modal — mockup `1u`

Category, amount, period (segmented control), "avisar em" ("warn at") 70/80/90%, current usage bar and 6-month bar history. Remove/save actions.

## 21. Goals ("Porquinhos") — `/goals` — mockup `1v`

Top card with the explicit account math: available balance − each goal = **livre para gastar** (R9), with a segmented bar. 2×N goal grid (icon, name, deadline, saved/target, bar, pace status, remaining amount) + a ghost "Criar porquinho" card.

## 22. Goal detail — `/goals/[id]` — mockup `1w`

Large progress indicator, pace verdict card, metadata (target date, monthly target contribution, where it's held), transactions, Guardar / Resgatar (save / withdraw) actions.

## 23. Net worth — `/net-worth` — mockup `1x`

6M/12M/All selector, 34px value + change over the period, available/invested breakdown, monthly bars (current month in the accent color, next month outline-only = projection), growth insight vs. target.

## 24. Analysis — `/analysis` — mockup `1y`

Categoria/Cartão/Conta segmented control + period filter. Main column: one card per category with value, a bar proportional to the largest value, nature, % of total, limit, and change vs. previous month. Sidebar: **spend nature** (fixed / commitments / variable, with the note that only variable spend is adjustable short-term), monthly expenses (6 bars), and an insight on where the variance is coming from.

## 25. Alerts and insights — `/alerts` — mockup `1z`

Two groups: "Pedem atenção" ("Needs attention") and "Boas notícias" ("Good news"). Card: severity icon, title, explanation with numbers and action buttons. Tunable in Configurar (R13).

## 26. Categories and settings — `/settings` — mockup `1aa`

Category table (name with icon, nature, limit, spend this month) + creation (`2d`). Settings: recommended card utilization, months of projection, hide amounts on screen, email alerts, **financial month start day** (R5).

## 27. Setup forms — mockups `2a`–`2e`

- **New account** `2a`: institution, nickname, type, current balance + date (this is an opening balance, it doesn't generate a backdated transaction), include in totals.
- **New card** `2b`: name, debit account, limit, closing day, due day, utilization alert, and a block explaining the consequence ("a purchase made by day 12 lands on this month's invoice").
- **New investment** `2c`: name, type, account, amount applied, current value, liquidity, option to debit the contribution now, preview showing that expenses don't change (R1).
- **New category** `2d`: name, **nature** (fixed / variable / commitment), icon, optional limit.
- **Invoice** `2e`: there is no invoice creation form. Three operations: **pay** (computed amount, amount paid, account, date, full/partial), **adjust** (difference + reason, entered as its own transaction), **enter a past invoice** (month + total, for someone starting to use the app with open invoices).

## 28. States — mockup `1ab`

Four states every data screen needs:

- **Empty / first access**: icon, sentence about what to do, actions ("Cadastrar salário", "Novo lançamento").
- **Loading**: skeletons shaped like the real content (never a centered spinner).
- **Error**: red icon, "Seus dados estão salvos" ("Your data is saved"), retry button.
- **Low-information projection**: explains that only recurrences and installments are projected, and from when variable spend starts being estimated (R8).

Also add a **silent success state**: on save, close the modal and highlight the created row for 1.2s (accent background at 10%, no toast).
