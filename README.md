# Gadgetzan

Aplicação de finanças pessoais, self-hosted e single-user. Ver `CLAUDE.md` e `docs/agents/` para especificação completa.

## Setup local

1. Copie o `.env.example` para `.env` e ajuste `DB_PASSWORD` / `AUTH_SECRET`.
2. Suba o Postgres:
   ```bash
   pnpm docker:up
   ```
3. Instale as dependências e gere o client do Prisma:
   ```bash
   pnpm install
   pnpm db:generate
   ```
4. Rode as migrations:
   ```bash
   pnpm db:migrate
   ```
5. Crie o usuário único da aplicação:
   ```bash
   pnpm create-user --email voce@example.com --password suasenha
   ```
6. Semeie as categorias padrão:
   ```bash
   pnpm db:seed
   ```
7. Suba o servidor de desenvolvimento:
   ```bash
   pnpm dev
   ```

## Scripts

| Script | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento Next.js |
| `pnpm build` | Build de produção |
| `pnpm test` | Testes Vitest (regras financeiras) |
| `pnpm db:migrate` | Aplica migrations em desenvolvimento |
| `pnpm db:seed` | Semeia categorias padrão para o usuário existente |
| `pnpm create-user` | Cria o usuário único da aplicação |
| `pnpm docker:up` / `docker:down` | Sobe/derruba o Postgres via Docker Compose |

## Backup e restore

`TODO` (Stage 7): script diário de `pg_dump` para um volume mapeado, com passo a passo de restore.
