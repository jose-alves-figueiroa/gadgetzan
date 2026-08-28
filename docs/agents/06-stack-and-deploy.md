# 06 — Stack, structure, and deploy

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** — tokens from `04-design-tokens.md` in `tailwind.config.ts`
- **Prisma** + **PostgreSQL 16**
- **NextAuth** (Credentials provider)
- **Zod** for input validation (shared between the form and the server action)
- **Server Actions** for writes; Server Components for reads. No REST layer unless a real need shows up.
- **Vitest** (rules) + **Playwright** (flows)
- **Recharts** or **visx** for charts (dev's choice; conventions in `04`)
- `@phosphor-icons/react` for icons
- `date-fns` + `date-fns-tz` for dates

No global state: data comes from the server; forms use `useActionState`/react-hook-form. No Redux/Zustand at this scale.

## Suggested structure

```
app/
  (auth)/login/page.tsx
  (app)/
    page.tsx                    # dashboard
    month/[month]/page.tsx
    future/page.tsx
    transactions/page.tsx
    transactions/[id]/page.tsx
    accounts/page.tsx
    accounts/[id]/page.tsx
    cards/page.tsx
    cards/[id]/page.tsx
    cards/[id]/invoices/page.tsx
    purchases/[id]/page.tsx
    investments/page.tsx
    goals/page.tsx
    goals/[id]/page.tsx
    recurrences/page.tsx
    calendar/page.tsx
    limits/page.tsx
    analysis/page.tsx
    net-worth/page.tsx
    alerts/page.tsx
    simulate/page.tsx
    simulate/result/page.tsx
    settings/page.tsx
    onboarding/page.tsx
  api/auth/[...nextauth]/route.ts
components/
  ui/            # Button, Field, Segmented, Card, Tag, Table, Modal, Bar, Donut, Tooltip
  finance/       # KpiRow, MonthPicker, CategoryDonut, LimitBar, GoalCard, InvoiceTable, AlertCard
  layout/        # Sidebar, Topbar, AppShell
lib/
  finance/
    money.ts          # cents, pt-BR parsing and formatting
    period.ts         # financial month (R5)
    invoice.ts        # invoice assignment and total (R3)
    installments.ts   # installment splitting (R4)
    projection.ts     # projection and projected balance (R7, R8)
    savings.ts        # savings rate (R2)
    goals.ts          # goal pace (R9)
    limits.ts         # limit utilization
    networth.ts       # net worth (R11)
    simulate.ts       # pure simulation (R10)
    alerts.ts         # triggers (R13)
  auth.ts
  db.ts
prisma/schema.prisma
```

**Golden rule**: everything in `lib/finance/` is a pure function, no Prisma inside it, receiving already-loaded data. That's what makes the rules testable and the simulator trustworthy.

## Auth

Single-user today, but with `userId` on everything (`01-data-model.md`).

- Credentials provider, password hashed with **argon2** (or bcrypt cost ≥ 12).
- User created via script: `pnpm tsx scripts/create-user.ts --email ... --password ...` — no public signup screen.
- Session in an httpOnly cookie, `SameSite=Lax`, `secure` when served over HTTPS.
- `middleware.ts` protects everything outside `/login`.
- Every query filters by `session.user.id`. **Never** trust an id coming from the client.
- Local network: still needs a strong `AUTH_SECRET`, simple login rate limiting (5 attempts / 10 min), and HTTPS via a reverse proxy if exposed.

## Docker Compose

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gadgetzan
      POSTGRES_USER: gadgetzan
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [db:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gadgetzan"]
      interval: 5s
  app:
    build: .
    environment:
      DATABASE_URL: postgres://gadgetzan:${DB_PASSWORD}@db:5432/gadgetzan
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: ${AUTH_URL}
      TZ: America/Sao_Paulo
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
volumes:
  db:
```

- Multi-stage `Dockerfile` with `output: 'standalone'` in `next.config`.
- Migrations on start: `prisma migrate deploy`.
- **Backup**: a daily `pg_dump` script into a mapped volume — it's someone's only copy of their financial data. Document how to restore in the repo README.
- Seed: **empty**. `prisma/seed.ts` only creates the default categories suggested in `01`; everything else comes from onboarding.

## Code conventions

- Money is always `amountCents: number`; helpers `toCents(input: string)` and `formatBRL(cents)`.
- Accrual dates as `YYYY-MM-DD` (string) at the edge; `Date` only internally.
- Domain names in English in the code, **all UI strings in pt-BR** (a single `lib/copy.ts` file or a light i18n setup — makes tone review easier).
- One test per rule from `02-business-rules.md`, named with the rule's code (`R4 splits cents into the last installment`).
