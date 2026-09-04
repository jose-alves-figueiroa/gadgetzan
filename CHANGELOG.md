# Changelog

## [03/09/2026 - 21:47]

### Corrigido

- Na tela da conta (`/accounts/[id]`), "Entradas" e "Saídas" ignoravam transferências entre contas — uma transferência de R$ 40 e outra de R$ 240 saindo da conta não entravam em "Saídas", mesmo já debitando corretamente o "Saldo atual". A causa era reaproveitar `isIncome`/`isExpense` (que por R1 excluem TRANSFER do resultado/P&L) para uma pergunta diferente: "essa conta especificamente recebeu ou perdeu dinheiro nesse lançamento". Nova função pura `calculateAccountFlows` (`lib/finance/accounts.ts`), construída sobre o mesmo `accountTransactionDirection` que já colore as linhas da tabela, garante que os dois nunca voltem a divergir.

### Impacto

- "Entradas"/"Saídas" na tela da conta agora batem com `Saldo inicial + Entradas − Saídas = Saldo atual`, incluindo toda transferência de/para outras contas, aporte/resgate de investimento e pagamento de fatura — antes só transferências de entrada eram contadas (e de forma incompleta), e nenhuma saída não-EXPENSE entrava na soma.

## [03/09/2026 - 21:35]

### Adicionado

- Tela do cartão (`/cards/[id]`) passou a mostrar "Comprometido" (total não pago comprometido contra o limite) como terceiro KPI, ao lado de Limite e Disponível — antes só limite e disponível apareciam, então não dava pra ver quanto já tinha sido gasto sem fazer conta de cabeça. A lista de cartões (`/cards`) ganhou a mesma informação na legenda de cada cartão.
- Rodapé "Total da fatura" abaixo da tabela de lançamentos da fatura, sempre que existe uma fatura para o mês (inclusive quando ela foi lançada manualmente via "Lançar fatura já existente" e não tem nenhum lançamento associado — antes esse total nunca aparecia em lugar nenhum nesse caso).
- Botão "Desfazer pagamento" na fatura quando ela está paga — reverte o(s) pagamento(s) e a fatura volta a aparecer como em aberto. Se o pagamento foi feito com "Transferir de outra conta", a transferência correspondente é desfeita junto (só quando o casamento entre pagamento e transferência é inequívoco por conta/valor/data/nota; em caso de ambiguidade a transferência não é tocada e precisa ser excluída manualmente em Lançamentos).
- Linhas de lançamento nas tabelas somente-leitura de Cartão, Conta e Porquinho agora abrem `/transactions/[id]` ao clicar (ou Enter/Espaço com foco no teclado) — antes essas tabelas eram só leitura, sem nenhuma forma de editar ou excluir o que aparecia lá.
- Conta (`/accounts/[id]`): valores na tabela de lançamentos agora aparecem em verde (entrada nessa conta) ou vermelho (saída dessa conta), com o mesmo sinal usado no cálculo de saldo (`calculateAccountBalance`) — TRANSFER, INVESTMENT_IN/OUT e CARD_PAYMENT entram na conta certa em vez de ficar tudo na cor neutra.

### Corrigido

- Excluir um lançamento de pagamento de fatura (`CARD_PAYMENT`) pela tela de Lançamentos apagava a transação mas não atualizava `paidCents`/`paidAt` da fatura — ela continuava aparecendo como paga mesmo com o pagamento excluído. `deleteTransaction` agora reverte a fatura corretamente nesse caso (mesma lógica usada pelo novo "Desfazer pagamento").

### Impacto

- Essas mudanças não alteram nenhum valor já salvo — só passam a exibir e permitir reverter dados que já existiam (fatura comprometida, total da fatura, pagamentos).
- Quem já excluiu um pagamento de fatura antes desta correção pode ter uma fatura com `paidCents` desatualizado; abrir a fatura e usar "Desfazer pagamento" resolve.

## [03/09/2026 - 21:10]

### Adicionado

- Ícone de olho na barra superior para ocultar/mostrar valores instantaneamente, em qualquer tela — sem precisar abrir Ajustes e salvar. Usa o mesmo campo `Settings.hideAmounts` e a mesma máscara CSS (`blur` em `.tabular-money`) já existentes; o clique aplica o efeito na hora (otimista) e persiste a preferência em segundo plano.

### Corrigido

- O rótulo de mês/ano da barra superior usava a mesma classe `.tabular-money` dos valores monetários só para alinhar os dígitos, então ficava borrado junto com os valores ao ativar "Ocultar valores". Passou a usar uma classe própria (`.tabular-nums-mono`) com o mesmo efeito visual, sem entrar na máscara.
- Vários valores exibidos como parte de uma frase (ex.: "de R$ X", "R$ X disponível", "Ritmo necessário: R$ X/mês", "Patrimônio cresceu R$ X no período") não tinham a classe `.tabular-money` e continuavam visíveis com "Ocultar valores" ativado — em Contas, Cartões, Porquinhos, Patrimônio, Mês, Dashboard, Compra parcelada e nos modais de novo lançamento e pagamento de fatura. Cada número passou a ter seu próprio `<span className="tabular-money">`, preservando o texto ao redor.

### Impacto

- Quem já usava o checkbox "Ocultar valores na tela" em Ajustes não perde nada — continua funcionando, e agora reflete o estado alternado pelo ícone de olho (e vice-versa).
- Duas exceções conhecidas continuam mostrando valores mesmo com a máscara ativada: (1) o `title` nativo dos mini-gráficos de barra (Análise, Patrimônio, Dashboard) — só aparece ao passar o mouse, é tooltip do navegador e não pode ser borrado por CSS; (2) os títulos de alertas (`/alertas` e o card de alertas do dashboard) e as mensagens da simulação, que constroem o valor já dentro da frase em `lib/finance/alerts.ts` e `lib/finance/simulate.ts` — mascarar exigiria separar o texto do valor no modelo de domínio, o que não foi feito nesta mudança.

## [2026-09-02 22:49]

### Adicionado

- Recorrência de investimento (aporte): a tela de Recorrências ganhou um terceiro tipo, "Investimento", além de receita/despesa. Uma recorrência de aporte sempre debita de uma conta (sem opção de cartão) e é associada a um investimento em vez de uma categoria. Alimenta as projeções de saldo futuro em "Próximos meses" e na simulação, sem nunca contar como receita ou despesa.
- Lançar fatura já existente: nova ação na tela do cartão, visível quando o mês atual ainda não tem fatura aberta, para registrar o saldo de uma fatura de antes de começar a usar o app. Não cria nenhuma despesa — só grava o total devido na fatura.
- Pagar fatura via transferência: o modal de pagamento de fatura ganhou a opção "Transferir de outra conta", que cria a transferência entre contas e o pagamento da fatura numa única ação, em vez de exigir dois lançamentos manuais separados.
- Importador de CSV (`scripts/generate-imports.ts`) reescrito para ler os extratos bancários reais em vez de dados fixos no código. Todas as traduções de categoria, conta, cartão, descrição e regras de parcelamento/pagamento de fatura ficam centralizadas em `scripts/generate-import.mapper-rules.ts`.

### Corrigido

- O seletor de categoria permitia escolher uma categoria de receita (ex.: Salário) numa despesa, e vice-versa. Agora o seletor filtra pela natureza da categoria (receita vs. despesa/fixa/variável/compromisso) tanto no lançamento manual quanto na recorrência, com a mesma checagem também no servidor.
- Uma fatura lançada manualmente (saldo anterior ao uso do app, via "Lançar fatura já existente") não comprometia o limite disponível do cartão em nenhum lugar — dashboard, lista de cartões, detalhe do cartão, prévia de "Impacto ao salvar", alertas de utilização e simulação — e aparecia como "Projetado" com total R$ 0,00 em "Faturas projetadas". Todos esses pontos agora usam o mesmo cálculo de total da fatura (nova `getUnpaidInvoiceTotalCents`).
- O tooltip explicativo (ex.: "Despesa fixa") ficava cortado quando aberto dentro de um modal, por causa do `overflow` do card ao redor. Agora é renderizado fora do fluxo normal da página e se posiciona pela tela inteira, sem ser cortado.

### Impacto

- Recorrências de receita/despesa já cadastradas continuam funcionando sem nenhuma mudança de comportamento.
- Faturas manuais já lançadas antes desta correção (ex.: fatura de agosto/2026 do Cartão Inter) passam a refletir corretamente no limite disponível assim que a tela for recarregada — não é preciso relançar nada.
- Pagamento de fatura sem usar a opção de transferência continua funcionando exatamente como antes.
