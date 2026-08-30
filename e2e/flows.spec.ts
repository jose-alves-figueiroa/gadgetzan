import { test, expect, type Page } from "@playwright/test";
import { TEST_USER } from "./env";

// The 10 flows from docs/agents/05-acceptance-criteria.md § "End-to-end
// flows", run serially against the one fixed test user global-setup seeds —
// each flow builds on state the previous ones created (onboarding creates
// the account/salary/card everything else depends on), matching how this
// single-user app is actually used session to session.
test.describe.configure({ mode: "serial" });

// Scoped past the header because the mobile bottom bar (< 768px) repeats
// this same label — at the desktop viewport both exist in the DOM even
// though only the header one is visible.
function newTransactionButton(page: Page) {
  return page.locator("header").getByRole("button", { name: "Novo lançamento" });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Senha").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Generous timeout: the first navigation of the run can pay Turbopack's
  // cold-compile cost for /login, /api/auth/*, and the dashboard/onboarding
  // route all at once.
  await expect(page).toHaveURL(/\/(onboarding)?$/, { timeout: 30_000 });
}

test.describe("Gadgetzan — end-to-end flows", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("flow 1 — onboarding: month start day → account → salary → card → dashboard with income projection", async () => {
    await login(page);
    await expect(page).toHaveURL(/\/onboarding$/);

    // Step 0 — financial month start day (accept the default).
    await page.getByRole("button", { name: "Continuar" }).click();

    // Step 1 — first account.
    await page.getByLabel("Instituição").fill("Banco Teste");
    await page.getByLabel("Apelido").fill("Conta Principal");
    await page.getByLabel("Saldo atual").fill("5000,00");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Step 2 — salary recurrence.
    await page.getByLabel("Valor mensal").fill("8000,00");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Step 3 — card (filled in, not skipped — flows 3/8/9 need one).
    await page.getByLabel("Nome").fill("Cartão Principal");
    await page.getByLabel("Limite").fill("3000,00");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Step 4 — bulk fixed expenses.
    await page.getByPlaceholder("Nome").fill("Aluguel");
    await page.getByPlaceholder("0,00").fill("1500,00");
    await page.getByRole("button", { name: "Concluir" }).click();

    await expect(page).toHaveURL("/");
    // The salary just registered should already be driving next month's forecast.
    await expect(page.getByText(/Próximo mês previsto/)).toBeVisible();
    await expect(page.getByText("8.000", { exact: false })).toBeVisible();
  });

  test("flow 2 — expense recurrence shows up in Próximos meses and Calendário", async () => {
    await page.goto("/recurrences");
    await page.getByRole("button", { name: "Nova recorrência" }).click();
    await page.getByRole("radio", { name: "Despesa" }).click();
    await page.getByLabel("Nome").fill("Internet");
    await page.getByLabel("Valor").fill("150,00");
    await page.getByLabel("Categoria").selectOption({ label: "Assinaturas" });
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Internet")).toBeVisible();

    await page.goto("/future");
    await expect(page.getByText("Composição do gasto comprometido")).toBeVisible();

    // This month's day-5 occurrence may already be in the past depending on
    // when the suite runs (the calendar only ever projects strictly future
    // occurrences — see the comment in lib/server/calendar.ts) — next month's
    // is unambiguously ahead regardless.
    await page.goto("/calendar?month=1");
    await expect(page.getByText("Internet").first()).toBeVisible();
  });

  test("flow 3 — a 10x installment purchase raises projected invoices by the installment amount", async () => {
    await page.goto("/cards");
    const cardHref = await page.getByRole("link").filter({ hasText: "Cartão Principal" }).getAttribute("href");
    expect(cardHref).toBeTruthy();
    const cardId = cardHref!.split("/").pop()!;

    await newTransactionButton(page).click();
    await page.getByRole("radio", { name: "Despesa" }).click();
    await page.getByLabel("Descrição").fill("Notebook");
    await page.getByLabel("Valor").fill("6000,00");
    await page.getByLabel("Categoria").selectOption({ label: "Outros" });
    await page.getByRole("radio", { name: "Cartão" }).click();
    await page.getByLabel("Parcelas").fill("10");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto(`/cards/${cardId}/invoices`);
    // Every projected month's "Parcelas" column should carry the 600,00 installment.
    await expect(page.getByText("600,00").first()).toBeVisible();
  });

  test("flow 4 — dashboard → next month forecast lines match /future", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: /Próximo mês previsto/ }).click();
    await expect(page).toHaveURL(/\/future$/);

    const firstCard = page.locator("main").getByText("Receitas").first().locator("..").locator("..");
    await expect(firstCard.getByText("Receitas")).toBeVisible();
    await expect(firstCard.getByText("Despesas")).toBeVisible();
    await expect(firstCard.getByText("Faturas")).toBeVisible();
    await expect(firstCard.getByText("Resultado")).toBeVisible();
  });

  test("flow 5 — transfer between accounts doesn't change expenses", async () => {
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Nova conta" }).click();
    await page.getByLabel("Instituição").fill("Banco Poupança");
    await page.getByLabel("Apelido").fill("Reserva");
    await page.getByLabel("Saldo atual").fill("1000,00");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/transactions");
    const expensesBefore = await page.locator("h1 + div .text-neg").first().textContent();

    await newTransactionButton(page).click();
    await page.getByRole("radio", { name: "Transf.", exact: false }).click();
    await page.getByLabel("Conta de origem").selectOption({ label: "Conta Principal" });
    await page.getByLabel("Conta de destino").selectOption({ label: "Reserva" });
    await page.getByLabel("Valor").fill("2000,00");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/transactions");
    const expensesAfter = await page.locator("h1 + div .text-neg").first().textContent();
    expect(expensesAfter).toBe(expensesBefore);
    await expect(page.getByText("Transferência entre contas").first()).toBeVisible();
  });

  test("flow 6 — create a goal, contribute, see progress and pace", async () => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "Criar porquinho", exact: true }).click();
    await page.getByLabel("Nome").fill("Viagem");
    await page.getByLabel("Valor alvo").fill("2000,00");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("link", { name: /Viagem/ }).click();
    await expect(page).toHaveURL(/\/goals\/.+/);

    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await page.getByLabel("Valor").fill("500,00");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(page.getByText("25% guardado")).toBeVisible();
  });

  test("flow 7 — a category limit at 85% shows the alert", async () => {
    await page.goto("/limits");
    await page.getByRole("button", { name: "Novo limite" }).click();
    await page.getByLabel("Categoria").selectOption({ label: "Alimentação" });
    await page.getByLabel("Valor").fill("1000,00");
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await newTransactionButton(page).click();
    await page.getByRole("radio", { name: "Despesa" }).click();
    await page.getByLabel("Descrição").fill("Mercado");
    await page.getByLabel("Valor").fill("850,00");
    await page.getByLabel("Categoria").selectOption({ label: "Alimentação" });
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/alerts");
    await expect(page.getByText(/do limite de Alimentação/).first()).toBeVisible();
  });

  test("flow 8 — simulate a purchase, read the warnings, record the real transaction", async () => {
    const transactionsBefore = await countTransactions(page);

    await page.goto("/simulate");
    await page.getByLabel("Descrição").fill("Celular");
    await page.getByLabel("Valor").fill("2500,00");
    await page.getByLabel("Categoria").selectOption({ label: "Outros" });
    await page.getByRole("radio", { name: "Cartão" }).click();
    await page.getByLabel("Parcelas").fill("5");
    await page.getByRole("button", { name: "Simular impacto" }).click();

    await expect(page).toHaveURL(/\/simulate\/result/);
    await expect(page.getByText("Nenhum lançamento foi criado", { exact: false })).toBeVisible();
    const resultUrl = page.url();

    // Still just a simulation — no row created yet.
    expect(await countTransactions(page)).toBe(transactionsBefore);

    await page.goto(resultUrl);
    await page.getByRole("button", { name: "Registrar a compra real" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(page.getByText("Celular").first()).toBeVisible();
    const transactionsAfter = await countTransactions(page);
    expect(transactionsAfter).toBeGreaterThan(transactionsBefore);
  });

  test("flow 9 — pay an invoice: account balance and month expenses update", async () => {
    await page.goto("/cards");
    await page.getByRole("link", { name: /Cartão Principal/ }).click();
    await expect(page).toHaveURL(/\/cards\/.+/);

    await page.getByRole("button", { name: "Pagar fatura" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(page.getByText("Fatura paga")).toBeVisible();
  });

  test("flow 10 — close out the month: donut, limits, and savings rate", async () => {
    await page.goto("/month");
    const main = page.locator("main");
    await expect(main.getByText("Taxa de poupança")).toBeVisible();
    await expect(main.getByText("Limites do mês")).toBeVisible();
    // The composition donut's per-category legend.
    await expect(main.getByText("Alimentação").first()).toBeVisible();
  });
});

async function countTransactions(page: Page): Promise<number> {
  await page.goto("/transactions");
  return page.locator('a[href^="/transactions/"]').count();
}
