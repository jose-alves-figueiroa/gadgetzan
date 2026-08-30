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
| `pnpm test:e2e` | Suite Playwright dos 10 fluxos ponta a ponta — banco e servidor próprios, isolados (ver `e2e/README.md`) |
| `pnpm perf-check` | Verifica o requisito não funcional "dashboard < 500ms com ~6.000 lançamentos" — banco e servidor próprios (ver `scripts/perf-check.ts`) |
| `pnpm db:migrate` | Aplica migrations em desenvolvimento |
| `pnpm db:seed` | Semeia categorias padrão para o usuário existente |
| `pnpm create-user` | Cria o usuário único da aplicação |
| `pnpm docker:up` / `docker:down` | Sobe/derruba o Postgres via Docker Compose |

## Deploy em produção

1. Configure `.env` com valores reais — em especial `AUTH_SECRET` (gere com `openssl rand -base64 32`) e `NEXTAUTH_URL` apontando para a URL pública (ex.: `https://financas.example.com`, atrás de um reverse proxy com HTTPS — ver `docs/agents/06-stack-and-deploy.md § Auth`).
2. Suba os dois serviços:
   ```bash
   docker compose up -d --build
   ```
   O container `app` roda `prisma migrate deploy` automaticamente antes de iniciar (ver `Dockerfile`), então migrations pendentes são aplicadas a cada deploy sem passo manual.
3. Crie o usuário único (uma vez) e semeie as categorias padrão:
   ```bash
   docker compose exec app pnpm create-user --email voce@example.com --password suasenha
   docker compose exec app pnpm db:seed
   ```
4. Configure o backup diário (próxima seção) via cron no host.

Para atualizar uma instância existente: `git pull`, depois `docker compose up -d --build` de novo — o passo 3 só roda na primeira vez.

## Backup e restore

`scripts/backup.sh` faz `pg_dump` do serviço `db` em execução via `docker compose exec`, comprime e salva em `./backups/` (não versionado — são dados financeiros reais). Mantém os últimos 30 dias por padrão (`RETENTION_DAYS`).

```bash
./scripts/backup.sh
# Backup salvo em ./backups/gadgetzan-20260830-030000.sql.gz
```

Agende diariamente via cron no host (não dentro do container):

```bash
crontab -e
# roda todo dia às 3h, a partir do diretório do projeto
0 3 * * * cd /caminho/para/gadgetzan && ./scripts/backup.sh >> backup.log 2>&1
```

**Restore** (testado manualmente durante o Stage 7 — restaura limpo em um banco vazio):

```bash
# 1. Suba um Postgres vazio (ou zere o volume existente, se for restaurar por cima)
docker compose up -d db

# 2. Restaure o dump
gunzip -c backups/gadgetzan-TIMESTAMP.sql.gz | docker compose exec -T db psql -U gadgetzan -d gadgetzan

# 3. Suba a aplicação
docker compose up -d app
```

Se estiver restaurando por cima de um banco com dados (recuperação de desastre), derrube e recrie o volume primeiro: `docker compose down`, remova o volume `db` (`docker volume rm <projeto>_db`), suba `db` de novo antes do passo 2.
