/**
 * Non-functional check (E7-S7 / 05-acceptance-criteria.md § Non-functional):
 * "Dashboard loads in < 500ms with 5 years of history (~6,000 transactions)".
 *
 * Runs against a dedicated `gadgetzan_perf` database — never dev or the e2e
 * suite's `gadgetzan_test` — on its own port (3200) so it can't collide with
 * either. Seeds once and reuses the data on repeat runs (6,000 rows isn't
 * free to regenerate every time).
 *
 * Usage: pnpm build && pnpm exec tsx scripts/perf-check.ts
 * (build first — this starts a production server, matching how the
 * dashboard actually performs for a user, not the dev-mode compile cost.)
 */
import { execSync, spawn } from "node:child_process";
import { Client } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";

const PORT = 3200;
const DB_NAME = "gadgetzan_perf";
const ADMIN_URL = "postgres://gadgetzan:changeme@localhost:5432/postgres";
const DATABASE_URL = `postgres://gadgetzan:changeme@localhost:5432/${DB_NAME}`;
const BASE_URL = `http://localhost:${PORT}`;
const USER = { email: "perf@example.com", password: "PerfCheck123!" };
const TARGET_MS = 500;
const YEARS = 5;
const TRANSACTIONS_TARGET = 6000;

async function ensureDatabase() {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
  if (rowCount === 0) await admin.query(`CREATE DATABASE ${DB_NAME}`);
  await admin.end();
}

async function seed() {
  execSync("pnpm exec prisma migrate deploy", { env: { ...process.env, DATABASE_URL }, stdio: "inherit" });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

  let user = await prisma.user.findUnique({ where: { email: USER.email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: USER.email, passwordHash: await argon2.hash(USER.password), name: "Perf" },
    });
    await prisma.settings.create({ data: { userId: user.id } });
  }

  const existing = await prisma.transaction.count({ where: { userId: user.id } });
  if (existing >= TRANSACTIONS_TARGET) {
    console.log(`Already seeded: ${existing} transactions for ${USER.email}.`);
    await prisma.$disconnect();
    return;
  }

  let account = await prisma.account.findFirst({ where: { userId: user.id } });
  if (!account) {
    account = await prisma.account.create({
      data: {
        userId: user.id,
        institution: "Banco Perf",
        nickname: "Conta Perf",
        openingBalance: 10_000_00,
        openingDate: new Date(Date.now() - YEARS * 365 * 86_400_000),
      },
    });
  }

  let category = await prisma.category.findFirst({ where: { userId: user.id, nature: "VARIABLE" } });
  if (!category) {
    category = await prisma.category.create({
      data: { userId: user.id, name: "Perf", nature: "VARIABLE", icon: "tag" },
    });
  }

  console.log(`Seeding ${TRANSACTIONS_TARGET} transactions across ${YEARS} years...`);
  const months = YEARS * 12;
  const perMonth = Math.ceil(TRANSACTIONS_TARGET / months);
  const now = Date.now();
  const rows = [];
  for (let m = 0; m < months; m++) {
    for (let i = 0; i < perMonth; i++) {
      const date = new Date(now - m * 30 * 86_400_000 - i * 86_400_000);
      rows.push({
        userId: user.id,
        kind: i % 5 === 0 ? ("INCOME" as const) : ("EXPENSE" as const),
        description: `Lançamento ${m}-${i}`,
        amountCents: 1000 + ((i * 37) % 5000),
        competenceDate: date,
        categoryId: category.id,
        method: "ACCOUNT" as const,
        accountId: account.id,
      });
    }
  }
  // createMany in batches — a single 6k-row INSERT is fine for Postgres, but
  // chunk anyway in case TRANSACTIONS_TARGET grows later.
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.transaction.createMany({ data: rows.slice(i, i + BATCH) });
  }
  console.log(`Seeded ${rows.length} transactions.`);
  await prisma.$disconnect();
}

async function login(): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfSetCookie = csrfRes.headers.get("set-cookie") ?? "";
  const csrfToken = (await csrfRes.json()).csrfToken as string;
  const csrfCookie = csrfSetCookie.split(";")[0];

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({
      email: USER.email,
      password: USER.password,
      csrfToken,
      json: "true",
    }),
    redirect: "manual",
  });
  const setCookies = loginRes.headers.getSetCookie?.() ?? [loginRes.headers.get("set-cookie") ?? ""];
  const sessionCookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  if (!sessionCookie.includes("next-auth.session-token")) {
    throw new Error("Login failed — no session-token cookie returned.");
  }
  return sessionCookie;
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE_URL}/login`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Server never came up on " + BASE_URL);
}

async function main() {
  await ensureDatabase();
  await seed();

  console.log(`Starting production server on :${PORT}...`);
  const server = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      DATABASE_URL,
      AUTH_SECRET: "perf-check-secret-not-for-production-use",
      NEXTAUTH_URL: BASE_URL,
    },
    stdio: "inherit",
  });

  try {
    await waitForServer();
    const cookie = await login();

    // One warm-up request (route compilation / connection pool warm-up
    // shouldn't count against the number we report).
    await fetch(`${BASE_URL}/`, { headers: { cookie } });

    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const res = await fetch(`${BASE_URL}/`, { headers: { cookie } });
      await res.text();
      runs.push(performance.now() - start);
    }

    const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
    console.log(`\nDashboard response times (ms): ${runs.map((r) => r.toFixed(0)).join(", ")}`);
    console.log(`Average: ${avg.toFixed(0)}ms (target: <${TARGET_MS}ms)`);
    if (avg >= TARGET_MS) {
      console.error(`FAILED: average ${avg.toFixed(0)}ms >= ${TARGET_MS}ms target.`);
      process.exitCode = 1;
    } else {
      console.log("PASSED.");
    }
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
