# End-to-end tests

`pnpm test:e2e` runs the 10 flows from `docs/agents/05-acceptance-criteria.md § End-to-end flows`
against a **separate** database — never the local dev DB or Docker's `app` service.

## How it's isolated

- `playwright.config.ts` runs the app on port **3100** (dev normally uses 3000), production-built
  (`next build && next start`), pointed at `DATABASE_URL=…/gadgetzan_test` via the `webServer.env`
  override.
- `e2e/global-setup.ts` creates that database if it doesn't exist, runs `prisma migrate deploy`
  against it, wipes every table, and seeds one fixed user (`e2e/env.ts`'s `TEST_USER`) plus the
  default categories.
- The 10 flows share that one user's cumulative state and must run **serially, in file order**
  (`fullyParallel: false`, `workers: 1`) — flow 1's onboarding creates the account/salary/card
  everything after it depends on, same as how this single-user app is actually used.

Re-running `pnpm test:e2e` always starts from that same clean slate.

## Why production mode, not `next dev`

Earlier revisions ran the webServer with `next dev` for faster iteration. That intermittently
failed login: Turbopack's dev-mode HMR raced next-auth's client-side CSRF handshake, so the
`next-auth.csrf-token` cookie and the token actually POSTed to `/api/auth/callback/credentials`
would occasionally diverge, and `authorize()` was never even called. Building the tests against
`next build && next start` removed the whole class of flake — slower per run, but this is what
production actually looks like anyway (Docker runs the same build).

The `"next start" does not work with "output: standalone"` warning in the logs is expected and
harmless for this purpose — Playwright's tests interact through the DOM/ARIA tree, not pixels, so
the small number of assets `next start` doesn't serve identically to the standalone server don't
affect them.

## `NEXTAUTH_URL`

next-auth v4 reads this exact variable name — not `AUTH_URL`, which is what this project's `.env`
used until Stage 7. Building this harness is what surfaced that: without `NEXTAUTH_URL` set,
next-auth silently falls back to a default that doesn't match a non-3000 port, and rejects the
credentials callback as a host mismatch before `authorize()` ever runs. `.env.example`,
`docker-compose.yml`, and `06-stack-and-deploy.md` were all updated to `NEXTAUTH_URL` — if you're
running an older local `.env`, rename it there too.
