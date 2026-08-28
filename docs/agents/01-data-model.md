# 01 — Data model

Postgres via Prisma. Every domain table has `userId` (FK → `User`) even though it's single-user today: that's what allows multi-user later without a painful migration.

Conventions:

- **Money in cents, `Int`.** Never `Float`. pt-BR formatting only at the presentation edge.
- Financial event dates are `DateTime` in UTC, but the **accrual date** (the day the user sees) has no time component — store it as `DateTime @db.Date`.
- Nothing with history gets truly deleted: `archivedAt`/`endedAt` instead of delete, except where noted.

## Enums

```prisma
enum CategoryNature {
  FIXED        // recurring cost of living: housing, internet
  VARIABLE     // discretionary: food, leisure
  COMMITMENT   // obligation to a third party: family support, tithes, alimony
  INCOME       // income categories
}

enum TxKind {
  EXPENSE
  INCOME
  TRANSFER          // account → account
  INVESTMENT_IN     // account → investment (contribution)
  INVESTMENT_OUT    // investment → account (withdrawal)
  GOAL_IN           // reserve into a goal (doesn't move money between accounts)
  GOAL_OUT
  CARD_PAYMENT      // invoice payment: account → card
  CARD_ADJUSTMENT   // fees, interest, chargeback posted directly to the invoice
}

enum PaymentMethod {
  ACCOUNT   // debit/pix/cash on the account
  CARD      // credit card
}

enum Confidence {
  REALIZED    // already happened
  CONFIRMED   // already committed (contracted installment, closed invoice)
  RECURRING   // expected by recurrence rule
  PROJECTED   // estimated from history
}

enum Frequency { MONTHLY WEEKLY YEARLY }

enum RuleStatus { ACTIVE PAUSED ENDED }

enum LimitScope { TOTAL_MONTH CATEGORY CARD_UTILIZATION }

enum AccountType { CHECKING SAVINGS PAYMENT }

enum InvestmentKind { FIXED_INCOME TREASURY FUND STOCKS OTHER }
```

## Entities

### User / Settings

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())
  settings     Settings?
}

model Settings {
  id                  String @id @default(cuid())
  userId              String @unique
  // day the financial month starts on (1..28). Typically payday.
  monthStartDay       Int    @default(1)
  // months of projection shown in "Upcoming months"
  projectionMonths    Int    @default(6)
  // card utilization ceiling that triggers an alert, in percentage points
  cardUtilizationTarget Int  @default(70)
  // months of history used to project variable spend
  variableLookback    Int    @default(3)
  netWorthSubtractsOpenInvoices Boolean @default(false) // see 07-open-decisions.md
  // floor for projected balance used by alerts/simulation (D2); null = no floor
  minCashCents        Int?
  hideAmounts         Boolean @default(false)
  currency            String @default("BRL")
  locale              String @default("pt-BR")
}
```

### Account

```prisma
model Account {
  id              String      @id @default(cuid())
  userId          String
  institution     String      // "Nubank", "Inter"
  nickname        String      // "Main account"
  type            AccountType @default(CHECKING)
  openingBalance  Int         // cents, balance entered at setup
  openingDate     DateTime    @db.Date
  includeInTotals Boolean     @default(true)
  archivedAt      DateTime?
  cards           Card[]
  investments     Investment[]
}
```

Current balance is **not a column**: it's `openingBalance` plus the sum of the transactions that affect the account (see rule R12). Only cache it in a materialized view if performance actually demands it.

### Card

```prisma
model Card {
  id                 String  @id @default(cuid())
  userId             String
  accountId          String  // account that pays the invoice
  name               String
  limitCents         Int
  closingDay         Int     // 1..28, per card
  dueDay             Int     // 1..28, per card
  utilizationTarget  Int?    // overrides Settings.cardUtilizationTarget
  archivedAt         DateTime?
}
```

### Category

```prisma
model Category {
  id       String         @id @default(cuid())
  userId   String
  name     String
  nature   CategoryNature
  icon     String         // Phosphor icon name, e.g. "users-three"
  parentId String?        // optional subcategories
  archivedAt DateTime?
}
```

Default categories suggested during onboarding (the user can edit them) — these are real, user-facing category names and stay in pt-BR: Moradia (FIXED), Alimentação (VARIABLE), Transporte (VARIABLE), Lazer (VARIABLE), Saúde (VARIABLE), Educação (FIXED), Ajuda familiar (COMMITMENT), Igreja e doações (COMMITMENT), Assinaturas (FIXED), Outros (VARIABLE), Salário (INCOME), Outras receitas (INCOME).

### Transaction

The central table. A transaction affects **zero to two** "legs" (source account, destination), determined by `kind`.

```prisma
model Transaction {
  id             String        @id @default(cuid())
  userId         String
  kind           TxKind
  description    String
  amountCents    Int           // always positive; the sign comes from kind
  competenceDate DateTime      @db.Date  // the date the user sees
  categoryId     String?       // required for EXPENSE and INCOME
  method         PaymentMethod?
  accountId      String?       // source (EXPENSE/ACCOUNT, TRANSFER, INVESTMENT_IN, CARD_PAYMENT)
  toAccountId    String?       // destination (TRANSFER, INVESTMENT_OUT)
  cardId         String?       // EXPENSE/CARD, CARD_PAYMENT, CARD_ADJUSTMENT
  investmentId   String?       // INVESTMENT_IN / INVESTMENT_OUT
  goalId         String?       // GOAL_IN / GOAL_OUT
  invoiceId      String?       // invoice it landed on (computed at creation, see R3)
  purchaseId     String?       // originating installment purchase
  installmentNo  Int?          // 1..n
  recurrenceId   String?       // occurrence generated by a rule
  isFixed        Boolean       @default(false)
  note           String?
  createdAt      DateTime      @default(now())

  @@index([userId, competenceDate])
  @@index([userId, categoryId, competenceDate])
  @@index([invoiceId])
}
```

### Purchase (installment purchase)

```prisma
model Purchase {
  id            String   @id @default(cuid())
  userId        String
  description   String
  totalCents    Int
  installments  Int
  cardId        String
  categoryId    String
  purchaseDate  DateTime @db.Date
  transactions  Transaction[]  // one per installment, created at write time
}
```

Installments are **materialized** at purchase creation time (n `Transaction` rows with `installmentNo`), not computed at read time. That's what makes a future invoice "confirmed" rather than "projected."

### Invoice

Invoices are **not created by the user** — they're generated by the system (R3). The record exists to carry payment, adjustments, and closing.

```prisma
model Invoice {
  id           String    @id @default(cuid())
  userId       String
  cardId       String
  // invoice reference month: first day of the due month
  referenceMonth DateTime @db.Date
  closingDate  DateTime  @db.Date
  dueDate      DateTime  @db.Date
  closedAt     DateTime?           // set once closingDate has passed
  paidAt       DateTime?
  paidCents    Int?                // can differ from the total (partial payment)
  manualTotalCents Int?            // old invoice entered in bulk (onboarding)
  transactions Transaction[]

  @@unique([cardId, referenceMonth])
}
```

`totalCents` is derived: the sum of `Transaction` rows with that `invoiceId` (+ `CARD_ADJUSTMENT`), or `manualTotalCents` when the invoice was entered in bulk.

### RecurrenceRule

```prisma
model RecurrenceRule {
  id          String        @id @default(cuid())
  userId      String
  kind        TxKind        // EXPENSE or INCOME
  description String
  amountCents Int
  frequency   Frequency     @default(MONTHLY)
  dayOfMonth  Int?          // MONTHLY: 1..31 (see R6 on short months)
  weekday     Int?          // WEEKLY: 0..6
  monthOfYear Int?          // YEARLY
  categoryId  String
  method      PaymentMethod
  accountId   String?
  cardId      String?
  startDate   DateTime      @db.Date
  endDate     DateTime?     @db.Date
  status      RuleStatus    @default(ACTIVE)
}
```

Occurrences are **not materialized** into the future: the projection engine computes them. Once the user confirms it happened (or registers it once the date arrives), a `Transaction` is created with `recurrenceId` — see R7.

### Investment

```prisma
model Investment {
  id            String         @id @default(cuid())
  userId        String
  accountId     String
  name          String
  kind          InvestmentKind
  appliedCents  Int            // total contributed (maintained via transactions)
  currentCents  Int            // current value, updated manually
  lastValuationAt DateTime?    @db.Date
  liquidity     String?        // "Daily liquidity", "2029-01-01"
  archivedAt    DateTime?
}
```

### Goal ("porquinho")

```prisma
model Goal {
  id             String   @id @default(cuid())
  userId         String
  name           String
  icon           String
  targetCents    Int
  targetDate     DateTime? @db.Date
  monthlyTargetCents Int?
  // where the reserved money actually sits (account or investment)
  accountId      String?
  investmentId   String?
  closedAt       DateTime?
}
```

Goal balance = sum of `GOAL_IN` − `GOAL_OUT`. **The reserve is logical**: it doesn't move money between accounts, it just earmarks part of the available balance (R9).

### Limit

```prisma
model Limit {
  id           String     @id @default(cuid())
  userId       String
  scope        LimitScope
  categoryId   String?    // scope=CATEGORY
  cardId       String?    // scope=CARD_UTILIZATION
  amountCents  Int?       // TOTAL_MONTH and CATEGORY
  percent      Int?       // CARD_UTILIZATION
  period       Frequency  @default(MONTHLY)
  warnAtPercent Int       @default(80)
  // whether TOTAL_MONTH includes COMMITMENT-nature spend (D4); irrelevant for other scopes
  includeCommitments Boolean @default(false)
  archivedAt   DateTime?
}
```

### Alert

Alerts are **derived**, computed on every dashboard load (R13). Only persist what needs interaction memory:

```prisma
model AlertState {
  id          String   @id @default(cuid())
  userId      String
  alertKey    String   // e.g. "limit:category:<id>:2026-08"
  dismissedAt DateTime?
  @@unique([userId, alertKey])
}
```

### Simulation

**Not persisted.** A simulation is a pure function over current state + a hypothesis, run in memory (R10). If you want history later, see `07-open-decisions.md`.
