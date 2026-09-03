/**
 * Regras de tradução/mapeamento dos CSVs bancários
 * para os valores aceitos pelo Gadgetzan.
 *
 * Este arquivo NÃO deve conter lógica de parsing.
 * Ele serve apenas como configuração/mapeamento.
 *
 * Os mapas são tipados como `Record<string, string>` (sem `as const`)
 * de propósito: eles são indexados em runtime com strings vindas dos
 * CSVs bancários, e `as const` produziria tipos-união literais que o
 * TypeScript rejeita ao indexar com uma `string` genérica.
 */

// ============================================================
// COLUNAS DE ORIGEM
// ============================================================
//
// Nomes exatos das colunas em cada CSV de origem, por campo
// lógico. Cada campo aceita múltiplos aliases — o primeiro
// encontrado no arquivo vence. Os 5 arquivos de origem NÃO
// compartilham um formato comum (nubank-cartao.csv, por exemplo,
// usa "date"/"title"/"amount" e colunas numéricas de parcela em
// vez de um texto "Parcela"), então cada fonte tem sua própria
// entrada. Ajuste aqui quando um formato de exportação mudar —
// nunca hardcode nomes de coluna em generate-imports.ts.
//
// `text`: campo usado para classificação (detectar transferência,
// pagamento de fatura, etc.) — o texto mais rico disponível.
// `description`: campo usado como descrição de exibição no
// Gadgetzan quando a origem não fornece um título melhor.

// Aceita as duas capitalizações vistas nos arquivos reais
// ("ID Externo" e "ID externo") — arquivos diferentes do mesmo
// usuário já vieram com grafias distintas.
const EXTERNAL_ID_ALIASES = ["ID Externo", "ID externo"];

export const SOURCE_COLUMNS = {
  nubankConta: {
    date: ["Data"],
    value: ["Valor"],
    externalId: EXTERNAL_ID_ALIASES,
    text: ["Descrição Banco", "Descrição"],
    description: ["Descrição Banco", "Descrição"],
    category: ["Categoria"],
  },
  interConta: {
    date: ["Data Lançamento", "Data"],
    value: ["Valor"],
    externalId: EXTERNAL_ID_ALIASES,
    text: ["Histórico", "Descrição"],
    description: ["Descrição", "Histórico"],
    category: ["Categoria"],
  },
  // nubank-cartao.csv e inter-cartao.csv compartilham o mesmo
  // formato "date/title/amount" com parcela em colunas numéricas
  // — diferente do formato "Data/Estabelecimento/Parcela" do
  // xp-cartao.csv.
  nubankCartao: {
    date: ["date", "Data"],
    value: ["amount", "Valor"],
    externalId: EXTERNAL_ID_ALIASES,
    title: ["title", "Estabelecimento"],
    description: ["Descrição", "Descricao"],
    category: ["Categoria"],
    // Nubank já fornece a parcela como duas colunas numéricas em
    // vez de um texto "2/4" — não há coluna de parcela em texto.
    installmentCurrent: ["Parcela atual"],
    installmentTotal: ["Total de Parcelas"],
  },
  interCartao: {
    date: ["date", "Data"],
    value: ["amount", "Valor"],
    externalId: EXTERNAL_ID_ALIASES,
    title: ["title", "Estabelecimento"],
    description: ["Descrição", "Descricao"],
    category: ["Categoria"],
    installmentCurrent: ["Parcela atual"],
    installmentTotal: ["Total de Parcelas"],
  },
  xpCartao: {
    date: ["Data"],
    value: ["Valor"],
    externalId: EXTERNAL_ID_ALIASES,
    title: ["Estabelecimento"],
    description: ["Descrição", "Descricao"],
    category: ["Categoria"],
    installmentText: ["Parcela", "parcela"],
  },
} as const;

// ============================================================
// CATEGORIAS
// ============================================================

export const CATEGORY_MAP: Record<string, string> = {
  // Já existentes no Gadgetzan
  Moradia: "Moradia",
  Alimentação: "Alimentação",
  Transporte: "Transporte",
  Lazer: "Lazer",
  Saúde: "Saúde",
  Educação: "Educação",
  "Ajuda familiar": "Ajuda familiar",
  "Igreja e doações": "Igreja e doações",
  Assinaturas: "Assinaturas",
  Outros: "Outros",
  Salário: "Salário",
  "Outras receitas": "Outras receitas",
  "Cuidados Pessoais": "Cuidados Pessoais",
  "Compras Online": "Compras Online",
  "Combustível": "Combustível",
  Contas: "Contas",
  Viagem: "Viagem",
  Feira: "Feira",
  "Bares e Restaurantes": "Bares e Restaurantes",

  // Traduções / variações encontradas nos bancos
  "Lanches e Restaurantes": "Bares e Restaurantes",

  Assinatura: "Assinaturas",

  "Edução": "Educação",

  "Cuidados pessoais": "Cuidados Pessoais",
  "Cuidado pessoais": "Cuidados Pessoais",

  "Compras online": "Compras Online",

  Combustivel: "Combustível",

  "Igreja e doacoes": "Igreja e doações",

  "Ajuda Familiar": "Ajuda familiar",

  "Outras Receitas": "Outras receitas",

  "Bares e restaurantes": "Bares e Restaurantes",

  "Saude": "Saúde",

  "Educacao": "Educação",
};

/**
 * Nomes de categoria aceitos pelo Gadgetzan (valores canônicos).
 * Derivado dos valores de CATEGORY_MAP — nunca das chaves, já que
 * as chaves incluem variações/traduções, não apenas nomes válidos.
 */
export const VALID_CATEGORIES: readonly string[] = Array.from(
  new Set(Object.values(CATEGORY_MAP)),
);

// ============================================================
// CONTAS
// ============================================================

export const ACCOUNT_MAP: Record<string, string> = {
  // Nubank
  Nubank: "Nubank",
  NUBANK: "Nubank",
  "Banco Nubank": "Nubank",

  // Inter
  Inter: "Inter",
  INTER: "Inter",
  "Banco Inter": "Inter",
  "Banco Inter S.A.": "Inter",

  // XP
  XP: "XP",
  "Banco XP": "XP",
  "XP Investimentos": "XP",
};

export const VALID_ACCOUNTS: readonly string[] = Array.from(
  new Set(Object.values(ACCOUNT_MAP)),
);

// ============================================================
// CARTÕES
// ============================================================

export const CARD_MAP: Record<string, string> = {
  Nubank: "Cartão Nubank",
  "Cartão Nubank": "Cartão Nubank",

  Inter: "Cartão Inter",
  "Cartão Inter": "Cartão Inter",

  XP: "Cartão XP",
  "Cartão XP": "Cartão XP",
};

export const VALID_CARDS: readonly string[] = Array.from(
  new Set(Object.values(CARD_MAP)),
);

// ============================================================
// PORQUINHOS
// ============================================================
//
// Você disse que NÃO possui porquinhos cadastrados.
//
// Portanto não devemos inventar um nome no Gadgetzan.
//
// O movimento deve ser ignorado e reportado como warning até que
// exista um mapeamento aqui.
//
// A chave é um trecho (case-insensitive) que identifica o
// porquinho na descrição/histórico do extrato; o valor é o nome
// exato do porquinho no Gadgetzan.
//
// Exemplo:
//
// export const PIGGY_BANK_MAP: Record<string, string> = {
//   "Porquinho Feira": "Feira",
// };
//

export const PIGGY_BANK_MAP: Record<string, string> = {};

// ============================================================
// INVESTIMENTOS
// ============================================================
//
// Você disse que NÃO possui investimentos cadastrados.
//
// Portanto, por enquanto, movimentos de investimento devem ser
// ignorados e reportados para revisão.
//
// A chave é um trecho (case-insensitive) que identifica o
// investimento na descrição/histórico do extrato; o valor é o nome
// exato do investimento no Gadgetzan.
//
// Quando houver investimentos no Gadgetzan:
//
// export const INVESTMENT_MAP: Record<string, string> = {
//   "Cdb Pos Di Liq. Banco Inter S A": "CDB Liquidez",
// };
//

export const INVESTMENT_MAP: Record<string, string> = {};

// ============================================================
// TIPOS DE MOVIMENTO
// ============================================================
//
// Usado para classificar o texto (Histórico/Descrição) de uma
// linha do extrato num tipo semântico de movimento.
//
// A classificação é apenas um SINAL: algumas classificações
// (ex.: "transfer") ainda exigem confirmação adicional (contraparte
// própria, reconciliação por data/valor) antes de virar um
// registro de saída — essa confirmação é lógica de parsing e vive
// em generate-imports.ts, não aqui.

export const TRANSACTION_TYPE_MAP: Record<string, string> = {
  // Pagamento de cartão
  "Pagamento de fatura": "card_invoice_payment",
  "Pagamento Fatura": "card_invoice_payment",
  "Pagamento recebido": "card_invoice_payment",

  // Transferências
  "Transferência": "transfer",
  "Transferencia": "transfer",
  "Pix enviado": "transfer",
  "Pix recebido": "transfer",

  // Investimentos
  "Aplicação": "investment_application",
  "Aplicacao": "investment_application",

  "Resgate": "investment_redemption",

  // Porquinhos
  "Aplicação RDB": "piggy_bank_application",
  "Aplicacao RDB": "piggy_bank_application",
  "Resgate RDB": "piggy_bank_redemption",

  // Receitas
  "Salário": "salary",
  "Salario": "salary",

  // Estornos
  "Estorno de compra": "invoice_adjustment",
  "RESGATE PONTOS": "invoice_adjustment",
};

// ============================================================
// DESCRIÇÕES ESPECÍFICAS
// ============================================================
//
// Algumas descrições permitem uma tradução mais precisa.
//
// Exemplo:
//
// "AmazonPrime" -> "Amazon Prime"
// "GoogleYoutubePremium" -> "YouTube Premium"
//
// Isso é opcional para o Gadgetzan, então deixamos apenas
// quando houver uma tradução realmente útil.
//
// A chave é comparada como um trecho (case-insensitive) do
// estabelecimento/descrição original.

export const DESCRIPTION_MAP: Record<string, string> = {
  AmazonPrime: "Amazon Prime",
  Amazonprimebr: "Amazon Prime",
  "Google YoutubePremium": "YouTube Premium",
  GoogleYoutubePremium: "YouTube Premium",
  Disney: "Disney+",
  "The Walt Disney Compan": "Disney+",
  Netflix: "Netflix",
  iFood: "iFood",
  Uber: "Uber",
};

// ============================================================
// INFERÊNCIAS DE CATEGORIA
// ============================================================
//
// Só usar quando a origem não fornece categoria.
//
// A regra deve ser conservadora.
// Não devemos classificar algo arbitrariamente só porque
// o nome "parece" pertencer a uma categoria.
//
// A chave é comparada como um trecho (case-insensitive) do
// estabelecimento/descrição original.

export const DESCRIPTION_CATEGORY_MAP: Record<string, string> = {
  Avani: "Ajuda familiar",
  "Condomínio": "Moradia",
  Condominio: "Moradia",
  IPTU: "Moradia",
  IPVA: "Transporte",
  Claro: "Contas",
  Tim: "Contas",
  TIM: "Contas",
  Neoenergia: "Contas",
  Compesa: "Contas",
  Hapvida: "Saúde",
  Uber: "Transporte",
  Petrobras: "Combustível",
  Petrocal: "Combustível",
  Netflix: "Assinaturas",
  AmazonPrime: "Assinaturas",
  Amazonprimebr: "Assinaturas",
  Disney: "Assinaturas",
  "Google One": "Assinaturas",
  GoogleYoutubePremium: "Assinaturas",
};

// ============================================================
// REGRAS DE CARTÃO
// ============================================================

export const CARD_PAYMENT_RULES = {
  /**
   * Linhas existentes no extrato do cartão que representam
   * pagamento da fatura.
   *
   * Essas linhas NÃO devem ser importadas.
   *
   * O pagamento correto vem do extrato da conta bancária.
   */
  ignoredCardPaymentDescriptions: [
    "Pagamento recebido",
    "Pagamento de fatura",
    "Pagamento Fatura",
  ],

  /**
   * Descrições no extrato bancário que indicam pagamento
   * de uma fatura.
   */
  bankPaymentDescriptions: [
    "Pagamento de fatura",
    "Pagamento Fatura",
    "Pagamento efetuado",
  ],
} as const;

// ============================================================
// REGRAS DE TRANSFERÊNCIA
// ============================================================

export const TRANSFER_RULES = {
  /**
   * Termos que indicam que a contraparte de um movimento é o
   * próprio usuário ou uma de suas contas — ou seja, candidato a
   * transferência entre contas próprias, não uma despesa/receita
   * comum. Ainda exige reconciliação por data/valor entre extratos
   * antes de virar uma transferência de fato.
   */
  ownAccountKeywords: [
    "Jose Ricardo",
    "José Ricardo",
    "Banco Inter",
    "Banco XP",
    "XP",
    "Nubank",
    "Inter",
  ],

  /**
   * Destinos conhecidos.
   */
  destinations: {
    inter: "Inter",
    nubank: "Nubank",
    xp: "XP",
  },
} as const;

// ============================================================
// REGRAS DE PARCELAMENTO
// ============================================================

export const INSTALLMENT_RULES = {
  /**
   * A informação encontrada no título da transação
   * tem prioridade sobre a coluna Parcela.
   *
   * Exemplo:
   *
   * Estabelecimento:
   *   "Amazon - Parcela 2/3"
   *
   * Parcela:
   *   "1/3"
   *
   * Resultado:
   *   2/3
   */
  titleHasPriority: true,

  patterns: [/parcela\s*(\d+)\s*\/\s*(\d+)/i, /(\d+)\s+de\s+(\d+)/i],
} as const;

// ============================================================
// REGRAS ESPECIAIS
// ============================================================

export const SPECIAL_RULES = {
  /**
   * Esse pagamento de R$113,85 ocorrido no Inter em 05/08
   * corresponde à fatura de julho do Cartão Nubank.
   *
   * Casado por (data, centavos) — nunca só pelo valor — para não
   * atribuir por engano qualquer outro pagamento coincidente de
   * R$113,85 a essa fatura específica.
   */
  interNubankJulyInvoicePayment: {
    date: "2026-08-05",
    cents: 11385,
    card: "Cartão Nubank",
    invoiceMonth: "2026-07",
  },

  /**
   * Pagamentos de fatura identificados no extrato da conta Nubank
   * pertencem, por padrão, ao Cartão Nubank (a pessoa paga a
   * própria fatura Nubank a partir da própria conta Nubank).
   */
  nubankAccountInvoiceCard: "Cartão Nubank",

  /**
   * Pagamentos feitos da conta Nubank para Banco XP que
   * correspondem aos valores das faturas do cartão XP.
   */
  xpInvoicePayments: [
    {
      date: "2026-08-08",
      cents: 115355,
      card: "Cartão XP",
    },
    {
      date: "2026-08-20",
      cents: 26939,
      card: "Cartão XP",
    },
  ],
} as const;

// ============================================================
// MOVIMENTOS A IGNORAR
// ============================================================

export const IGNORE_RULES = {
  /**
   * Teste técnico de R$0,01 entre Inter/Nubank.
   */
  technicalTransfers: [
    {
      cents: 1,
      description: "Jose Ricardo",
    },
  ],

  /**
   * Transferências para si mesmo sem contraparte confirmada
   * não devem virar despesa/receita.
   */
  unconfirmedOwnTransfers: true,

  /**
   * Investimentos sem um investimento correspondente
   * cadastrado no Gadgetzan não devem ser inventados.
   */
  unknownInvestments: true,

  /**
   * Porquinhos sem um porquinho correspondente
   * cadastrado no Gadgetzan não devem ser inventados.
   */
  unknownPiggyBanks: true,
} as const;
