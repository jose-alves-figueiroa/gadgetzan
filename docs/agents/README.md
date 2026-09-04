# Handoff: Gadgetzan — personal finance app

Handoff package to implement the app from the approved mockups in `design/Financas - Telas.dc.html`.

## Overview

Gadgetzan is a **pt-BR** personal finance app that answers, in order: how much do I have, how much did I spend, where did I spend it, what's already committed, what do the next few months look like, am I within my limits and goals, and **what happens if I buy this**. The product thesis is to be a decision assistant, not a ledger: every past-facing screen exists to feed a projection, and every projection exists to support a decision.

Usage: **single user (self-hosted, local network)**, typically reviewed monthly, manual data entry.

## About the design files

The files in `design/` are **HTML design references** — prototypes showing intended look and behavior. **They are not production code and must not be copied into the app.** The task is to **recreate these designs in the target environment** (Next.js + TypeScript + Tailwind, see `06-stack-and-deploy.md`), using your own React components and the tokens listed in `04-design-tokens.md`.

`design/Financas - Telas.dc.html` opens in the browser (needs `design/support.js` next to it). Each screen has a short id (`1a`, `2b`, `3a`…) shown as a visible tag; the screens spec uses these ids to point to the matching mockup.

## Fidelity

**High fidelity (hifi).** Colors, typography, spacing, density, states, and final copy are all defined. The UI should be recreated faithfully, using the exact values from `04-design-tokens.md`. Conscious exceptions:

- The mockup is **desktop**. Mobile wasn't designed; `03-screens.md` indicates the expected responsive behavior per screen (general rule: single column, primary actions pinned to the bottom).
- Icons are **Phosphor Icons** (`@phosphor-icons/react`), same names used in the mockup.
- Charts were designed with plain CSS/SVG. They can be reimplemented with whichever library you prefer, as long as the visual reading is preserved (see `04-design-tokens.md § Charts`).

## How to read this package

| File | What it covers |
| --- | --- |
| `PROMPT.md` | Initial prompt ready to paste into Claude Code |
| `01-data-model.md` | Entities, fields, enums, full Prisma schema |
| `02-business-rules.md` | The rules that define the product (projection, invoice, savings, limits, goals, simulation, CSV import) |
| `03-screens.md` | Every screen: route, purpose, layout, data, states, mockup id |
| `04-design-tokens.md` | Colors, typography, spacing, components, charts |
| `05-acceptance-criteria.md` | Tests that define "done" |
| `06-stack-and-deploy.md` | Stack, folder structure, auth, Docker Compose |
| `07-open-decisions.md` | What still needs a decision from the product owner |
| `../import-runbook.md` | Handoff spec for whoever prepares CSV files to import (column formats, worked examples) — written for a codebase-blind reader, not an implementation doc |
| `../TECH-DEBT.md` | Known implementation shortcuts in already-specified behavior, tracked deliberately for later follow-up |

## Decisions already made (don't reopen without talking to the owner)

1. **Stack**: Next.js (App Router) + TypeScript + Tailwind + Prisma + Postgres, self-hosted via Docker Compose.
2. **Auth**: NextAuth with credentials, one user created via script, hashed password. Every table already carries `userId` to allow multi-user later.
3. **Data entry**: manual, plus **CSV batch import** for backfilling history (`02-business-rules.md` R15, `docs/import-runbook.md`) — validate/commit/undo/export, not the row-by-row approval originally floated. OFX import is still out of scope; see `07-open-decisions.md` D7.
4. **Financial month**: starts on a **configurable day** chosen by the user (typically payday), not on the 1st.
5. **Each card has its own closing day and due day.**
6. **Variable spend projection**: average of the last 3 months per category.
7. **Empty seed + onboarding**: no sample data in production; the app guides the first setup.
8. **A contribution is not an expense**, but it **counts as savings**. Commitments (alimony, family support, tithes/donations) are their **own spending nature**, separate from fixed cost of living and variable spending.

## Assets

No images or logos. Icons: Phosphor Icons (`ph` regular). Font: Inter (Google Fonts, weights 400/500/600). The full visual system is the **Nocturne** design system, whose tokens are transcribed in `04-design-tokens.md` — the app doesn't need to depend on the `_ds/` folder.

## Files

- `design/Financas - Telas.dc.html` — all mockups (rounds 1, 2, and 3)
- `design/support.js` — runtime required to open the mockup in the browser
- `design/styles.css` — Nocturne design system stylesheet (source of the tokens)
