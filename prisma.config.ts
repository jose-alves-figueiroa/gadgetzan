import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` doesn't connect to a database, so it must not hard-fail
// when DATABASE_URL isn't set (e.g. during a Docker build, where secrets are
// deliberately not baked into the image). `migrate`/`studio` need the real
// value, supplied via `.env` locally or `environment:` in docker-compose.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
