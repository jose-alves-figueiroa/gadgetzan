import { prisma } from "../lib/db";
import { toCents } from "../lib/finance/money";

const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "PAYMENT"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      args[key] = value;
      i++;
    }
  }
  return args;
}

function usage(): never {
  console.error(
    [
      "Uso: pnpm create-account --email you@example.com --institution \"Banco X\" --nickname \"Conta Principal\" [--type CHECKING|SAVINGS|PAYMENT] [--balance 0,00] [--date AAAA-MM-DD] [--exclude]",
      "",
      "  --email        obrigatório — dono da conta (criado via pnpm create-user)",
      "  --institution  obrigatório — nome do banco/instituição",
      "  --nickname     obrigatório — apelido da conta",
      "  --type         opcional — padrão CHECKING",
      "  --balance      opcional — saldo inicial em reais, padrão 0,00 (ex: 1.234,56)",
      "  --date         opcional — data do saldo inicial, padrão hoje",
      "  --exclude      opcional — não incluir esta conta nos totais (padrão: inclui)",
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  const { email, institution, nickname, type, balance, date, exclude } = parseArgs(process.argv.slice(2));

  if (!email || !institution || !nickname) usage();

  const accountType = (type?.toUpperCase() ?? "CHECKING") as AccountType;
  if (!ACCOUNT_TYPES.includes(accountType)) {
    console.error(`Tipo inválido: ${type}. Use um de: ${ACCOUNT_TYPES.join(", ")}.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Nenhum usuário com o email ${email}. Crie um primeiro com pnpm create-user.`);
    process.exit(1);
  }

  let openingBalance: number;
  try {
    openingBalance = toCents(balance ?? "0,00");
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Saldo inválido.");
    process.exit(1);
  }

  const openingDate = date ?? new Date().toISOString().slice(0, 10);

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      institution,
      nickname,
      type: accountType,
      openingBalance,
      openingDate: new Date(`${openingDate}T00:00:00.000Z`),
      includeInTotals: exclude === undefined,
    },
  });

  console.log(`Conta criada: ${account.nickname} (${account.institution}) — ${account.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
