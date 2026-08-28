# PROMPT.md — paste this into Claude Code

Use this prompt at the root of the `finance-app` repository, with this handoff folder inside it (or alongside it, adjusting the paths). The handoff files now live in `docs/agents/`.

---

You're going to implement **Gadgetzan**, a personal finance app in Brazilian Portuguese, self-hosted and single-user.

**Read these first, in order, and don't start coding before finishing:**

1. `docs/agents/README.md` — overview and decisions already made
2. `docs/agents/02-business-rules.md` — the 14 rules that define the product
3. `docs/agents/01-data-model.md` — full schema
4. `docs/agents/03-screens.md` — every screen
5. `docs/agents/04-design-tokens.md` — colors, typography, components
6. `docs/agents/06-stack-and-deploy.md` — stack and structure
7. `docs/agents/05-acceptance-criteria.md` — what needs to pass
8. `docs/agents/07-open-decisions.md` — what **not** to decide on your own

The files in `docs/agents/design/` are **reference HTML mockups** — don't copy that code. Open `Financas - Telas.dc.html` in a browser to see each screen; it has an id (`1a`, `2b`, `3a`…) that the spec uses to point at the design.

**Fixed stack**: Next.js (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL, NextAuth with credentials, Docker Compose. Money always in cents (`Int`), never `Float`.

**Work order** — stop at the end of each stage, run the tests, and show me the result before moving on:

**Stage 1 — foundation**
Project setup, Tailwind with the tokens from `04`, Prisma with the schema from `01`, Docker Compose, NextAuth, user-creation script, seed with default categories only. Base `components/ui` components (Button, Field, Segmented, Card, Tag, Table, Modal, Bar, Donut, Tooltip) and the shell (`Sidebar`, `Topbar`) per mockup `1a`.

**Stage 2 — financial engine (the core)**
All the pure functions in `lib/finance/` implementing R1–R13, **with Vitest tests written from `05-acceptance-criteria.md`**. No UI in this stage. Don't move on with a red test: if the projection is wrong, half the screens are born wrong.

**Stage 3 — setup forms and transactions**
Accounts (`2a`), cards (`2b`), categories (`2d`), investments (`2c`), recurrences (`1q`, `1r`), new transaction with installments (`1j`), transfer (`1l`), transaction list and detail (`1i`, `1k`), onboarding (R14).

**Stage 4 — present**
Dashboard (`1a`), month screen with donut (`3a`), accounts and detail (`1m`, `1n`), cards and current invoice (`1o`), investments (`1p`), invoice operations: pay, adjust, enter a past one (`2e`).

**Stage 5 — future**
Upcoming months (`1d`), projected invoices (`1e`), installment purchase detail (`1f`), calendar (`1s`), net worth (`1x`).

**Stage 6 — decision**
Limits (`1t`, `1u`), goals (`1v`, `1w`), alerts (`1z`), analysis (`1y`), simulator and result (`1g`, `1h`).

**Stage 7 — polish**
Empty/loading/error/low-confidence states on every data screen (`1ab`), responsive per `03`, accessibility (visible focus, targets ≥ 44px), Playwright tests for the 10 flows in `05`, operations README with backup and restore.

**Rules of conduct**

- Every financial rule lives in a pure function in `lib/finance/`, no Prisma inside. No calculations inside components.
- UI strings in pt-BR, centralized. Exact terminology from `04 § Copy`.
- Conceptual explanations go in a **tooltip**, not in screen copy (team decision).
- Don't invent a color, font, radius, or spacing outside the tokens.
- If a requirement in `07-open-decisions.md` blocks you, **ask** instead of choosing on your own.
- Never use `Float` for money; never compare accrual dates with a time component.
- At the end of each stage: `pnpm test`, `pnpm build`, and a summary of what was left out.

Start with Stage 1 and show me the Prisma schema and the shell running before moving on.
