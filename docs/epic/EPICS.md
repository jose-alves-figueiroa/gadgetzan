# Epics — Gadgetzan

Larger, deliberately-deferred pieces of follow-up work surfaced while implementing a feature or fixing a bug — most commonly a **data backfill/migration** needed to bring already-existing records in line with a new or changed business rule. These are not bugs or shortcuts (see `docs/TECH-DEBT.md` for those): the current behavior is correct going forward, but historical data hasn't been brought in line with it yet, and doing so needs explicit product-owner sign-off before running (which records, which date range, what shifts).

Status convention: `[ ]` open · `[~]` in progress · `[x]` resolved.

---

## Overview

| # | Item | Status |
| --- | --- | --- |
| 1 | [Backfill `competenceDate` for existing installments](#1-backfill-competencedate-for-existing-installments) | `[ ]` open |

---

## 1. Backfill `competenceDate` for existing installments

**Status**: `[ ]` open.

**Where**: `Transaction` rows with `installmentNo > 1` created before the R4 fix below.

**Context**: `docs/agents/02-business-rules.md` R4 was changed so that installment N (N > 1) of a card purchase gets `competenceDate` set to that installment's own invoice due date, instead of the original purchase date — see `CHANGELOG.md` entry from 04/09/2026. This makes each installment burden its own financial month (R5) in `/month`, category limits, alerts, analysis, and the dashboard, going forward. It only applies to installments created from that point on: installments already recorded in the database keep their old `competenceDate` (the original purchase date), still burdening the original purchase month everywhere that reads `Transaction.competenceDate`.

**Why not fixed inline**: a backfill rewrites historical financial data — every already-materialized installment row with `installmentNo > 1` — and retroactively shifts which financial month past installments count against (income/expense totals, category limits, savings rate, analysis for those past months all change). That needs explicit sign-off from the user on scope before running, not a migration silently bundled into the business-rule fix.

**How to apply**: for every `Transaction` with `installmentNo` set and `installmentNo > 1`, recompute `competenceDate` as that installment's invoice due date (`Invoice.referenceMonth` + the card's `dueDay`, reachable via the transaction's `invoiceId`) and update in place. Confirm with the user first: whether to backfill all-time or only installments on still-open/unpaid invoices, and which past months' totals are expected to shift as a result.

---

## Out of scope for this file

Implementation shortcuts in already-specified behavior belong in `docs/TECH-DEBT.md`, not here. Unresolved *product* decisions and explicit out-of-scope items belong in `docs/agents/07-open-decisions.md`.
