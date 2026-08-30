import { execSync } from "node:child_process";
import { Client } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { TEST_ADMIN_DATABASE_URL, TEST_DATABASE_URL, TEST_DB_NAME, TEST_USER } from "./env";
import { DEFAULT_CATEGORIES } from "../lib/server/default-categories";

async function ensureDatabaseExists() {
  const admin = new Client({ connectionString: TEST_ADMIN_DATABASE_URL });
  await admin.connect();
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB_NAME]);
  if (rowCount === 0) {
    // Database names can't be parameterized — TEST_DB_NAME is a fixed local constant, never user input.
    await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  }
  await admin.end();
}

/**
 * Runs once before the whole e2e suite (`playwright.config.ts`'s
 * `globalSetup`): points a dedicated `gadgetzan_test` database at the same
 * schema as dev, wipes it to a clean slate, and creates the one fixed test
 * user + default categories the flows in `e2e/flows.spec.ts` build on.
 */
export default async function globalSetup() {
  await ensureDatabaseExists();

  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });

  await prisma.alertState.deleteMany();
  await prisma.limit.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.recurrenceRule.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.card.deleteMany();
  await prisma.account.deleteMany();
  await prisma.category.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await argon2.hash(TEST_USER.password);
  const user = await prisma.user.create({
    data: { email: TEST_USER.email, passwordHash, name: "E2E" },
  });
  await prisma.settings.create({ data: { userId: user.id } });

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.create({ data: { userId: user.id, ...category } });
  }

  await prisma.$disconnect();
}
