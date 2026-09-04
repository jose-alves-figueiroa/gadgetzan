# Changelog

## [04/09/2026 - 16:18]

### Adicionado

- Recorrências ativas (`/recurrences`) ganharam a ação "Confirmar agora (dd/mm)", que antecipa/confirma a próxima ocorrência ainda não confirmada da regra: cria a `Transaction` real vinculada à recorrência (`recurrenceId`) com competência hoje, e marca a regra como confirmada até aquela data (`RecurrenceRule.confirmedThroughDate`) para que ela nunca mais seja projetada como `RECURRING` (R6). Funciona tanto para adiantar um pagamento que ainda está no futuro quanto para confirmar uma ocorrência já vencida — sempre a próxima ocorrência não confirmada da regra, decidida por `nextOccurrenceDate`. Suportado para recorrências de despesa/receita e de aporte em investimento; recorrências de outros tipos retornam erro. `confirmedThroughDate` também passou a ser respeitado por toda leitura de ocorrências projetadas (`/calendar`, `/future`, previsão de fatura), suprimindo qualquer ocorrência já confirmada nesses módulos.

### Impacto

- Recorrências nunca confirmadas manualmente continuam se comportando exatamente como antes (mesma projeção `RECURRING` de sempre). O efeito só aparece depois de um "Confirmar agora": aquela ocorrência específica some das projeções futuras porque já virou uma transação real.

## [04/09/2026 - 10:12]

### Modificado

- Tabela de lançamentos da tela de fatura do cartão (`/cards/[id]`) passou a colorir o valor: cobranças (`EXPENSE`/`CARD_ADJUSTMENT`, o que aumenta o total da fatura) em vermelho com prefixo "−"; `CARD_PAYMENT` (pagamento de fatura) em cinza neutro, sem sinal — não é receita nem despesa (R1), é a fatura sendo quitada. Mudança escopada só a essa tabela; o resto do app mantém o esquema atual (`04-design-tokens.md`: verde só para entradas/confirmações, vermelho reservado para estouro de limite/erro, despesa comum em texto neutro).

## [04/09/2026 - 10:05]

### Corrigido

- Uma fatura lançada manualmente (via "Lançar fatura já existente", `Invoice.manualTotalCents`) que depois recebia uma compra real no cartão nesse mesmo período tinha essa compra silenciosamente ignorada no total: `manualTotalCents` sempre vencia a soma dos lançamentos (`manualTotalCents ?? soma`), em vez de somar. Na prática, quem lançava o total manual da fatura do mês e depois fazia uma compra normal no mesmo cartão via o app via essa compra desaparecer do total a pagar — e, se a fatura já tivesse sido paga, o valor pago não incluía a compra nova, sem jeito de fazer um segundo pagamento pra cobrir a diferença. `findOrCreateInvoice` agora absorve o total manual num lançamento de despesa equivalente assim que uma fatura com `manualTotalCents` recebe um novo lançamento, e zera `manualTotalCents` — a partir daí a fatura volta a ser uma fatura normal, com o total sempre igual à soma dos lançamentos, pagável (e re-pagável, se já paga e receber lançamento novo) em qualquer valor.
- Corrigida em produção a fatura de 09/2026 do Cartão Inter, que estava nesse estado (R$904,12 manual + R$244,15 de combustível lançado depois, pagamento de R$904,12 já desfeito): o total manual virou um lançamento de despesa "Fatura (total lançado manualmente)" de R$904,12, sem apagar nenhum registro existente, e o total da fatura passou a refletir os R$1.148,27 (R$904,12 + R$244,15) corretamente.

### Impacto

- Faturas lançadas manualmente que nunca recebem lançamento novo continuam idênticas a antes (mesmo formulário "Lançar fatura já existente", mesmo botão "Editar total", mesmo "Apagar fatura" enquanto vazias). O comportamento só muda no momento em que uma fatura manual passa a ter um lançamento real vinculado — nesse ponto ela deixa de ter total manual e os botões "Editar total"/"Apagar fatura" (que dependem de `manualTotalCents`) somem, dando lugar ao fluxo normal de pagamento/fatura paga.

## [03/09/2026 - 23:23]

### Adicionado

- Novo lançamento parcelado no cartão: quando há mais de 1 parcela, um seletor "O valor acima é" deixa escolher entre "O total da compra" (comportamento de sempre — R$100 em 3x vira 3 parcelas de ~R$33,33) e "De cada parcela" (novo — 3x de R$100 vira 3 parcelas de R$100, total R$300, do jeito que o comércio costuma anunciar parcelamento). O rótulo do campo "Valor" muda para "Valor de cada parcela" nesse segundo modo, e o texto abaixo de "Parcelas" mostra o total calculado em vez da aproximação por parcela. Sempre envia o total pro servidor — o modo só muda a interpretação do que foi digitado.
- `centsToDecimalString` em `lib/finance/money.ts` (inverso de `toCents`, sem o "R$") — consolida uma função que já existia copiada em três modais diferentes.

## [03/09/2026 - 22:56]

### Modificado

- "Ocultar valores" trocou de `blur` para um placeholder de largura fixa (`R$ ***`) — o blur deixava a ordem de grandeza visível pela largura do borrão (um valor de 6 dígitos borra muito mais largo que um de 2), então dava pra estimar o valor sem decifrar os números. `R$ ***` tem sempre a mesma largura, não importa o valor real. As cores (verde/vermelho/cinza) continuam as mesmas de antes — só a cor do texto real é reaproveitada no placeholder, nunca redefinida.
- Descrições de lançamento (ex.: "Lanche") agora também são ocultadas com "***" junto dos valores — categoria e conta continuam visíveis. Aplicado na lista de Lançamentos, na tabela de fatura do cartão, na tabela da conta, no lote de importação e nos títulos de lançamento/compra parcelada.

### Corrigido

- Duas "Taxa de poupança" (Dashboard e Mês) e a decomposição por natureza (Análise, "R$ X (Y%)") usavam a classe `.tabular-money` só pra ganhar a fonte monoespaçada, sem serem valores monetários (uma é %, a outra mistura R$ com % no mesmo elemento) — com o blur isso já passava despercebido, mas com o placeholder de texto viraria "R$ ***" no lugar de uma porcentagem, ou apagaria o "(Y%)" junto do valor. Corrigido: as taxas passaram para `.tabular-nums-mono` (mesma classe do rótulo de mês da barra superior) e a porcentagem de Análise saiu de dentro do `.tabular-money`.

## [03/09/2026 - 22:20]

### Adicionado

- Botão "Apagar fatura" na tela do cartão, para uma fatura lançada manualmente (via "Lançar fatura já existente") sem nenhum lançamento e sem pagamento registrado — pra quando o valor e/ou o mês foram lançados errados e não tem o que corrigir, só desfazer. Bloqueado no servidor (não só escondido na tela) se já existir lançamento ou pagamento na fatura.

### Modificado

- O seletor de mês da barra superior era só decoração — trocava o rótulo mas não filtrava nada em lugar nenhum. Agora ele lê/escreve o mesmo parâmetro `?month=` que a tela do cartão e o calendário já usavam, então navegar por ele efetivamente troca de mês nessas telas. A tela do cartão perdeu seu próprio `‹ mês ›` (ficava duplicado com o de cima) — o rótulo do mês continua lá, só sem as setas.

### Impacto

- Em qualquer outra tela (sem noção de mês), as setas de cima ainda navegam — só ficam sem efeito visível, acumulando um `?month=` inofensivo na URL.

## [03/09/2026 - 22:15]

### Adicionado

- Ação "Editar saldo inicial" na conta (`/accounts/[id]`) — até agora só dava pra definir saldo/data de abertura na criação, sem forma de corrigir depois. Bloqueia a edição se a nova data ficar depois de algum lançamento já existente nessa conta (mesma regra que já impede lançar antes da abertura, agora também na direção contrária).

### Impacto

- Corrigir o saldo/data inicial recalcula todo o saldo/patrimônio histórico da conta, já que nunca são armazenados — só derivados de `saldo inicial + lançamentos` (R12).

## [03/09/2026 - 22:12]

### Adicionado

- Ação "Atualizar valor" em cada investimento (`/investments`) para lançar um rendimento/perda de mercado, ou corrigir um valor lançado errado — atualiza só `currentCents` (e `lastValuationAt`), sem criar lançamento nenhum.

### Corrigido

- Um aporte feito depois de criar o investimento (via "Novo lançamento") não alterava o valor atual mostrado em `/investments` — só criava o lançamento `INVESTMENT_IN`, sem tocar em `Investment.currentCents`/`appliedCents`. Isso fazia o aporte parecer ter "desaparecido": o dinheiro saía do saldo da conta mas o investimento continuava com o valor de antes, derrubando o patrimônio líquido total até alguém atualizar o valor manualmente. `createInvestmentMoveCore` agora ajusta os dois valores no mesmo instante do lançamento (aporte soma, resgate subtrai) — o mesmo caminho usado por recorrência de aporte confirmada continua correto.

### Impacto

- Investimentos com aportes/resgates já lançados antes desta correção ficaram com `currentCents` desatualizado — use "Atualizar valor" pra corrigir o valor de cada um manualmente.

## [03/09/2026 - 22:09]

### Corrigido

- Todo campo de data que se auto-preenchia com "hoje" (novo lançamento, pagar fatura, antecipar parcelas, aportar/resgatar porquinho, nova conta, nova recorrência, onboarding, simulador) usava `new Date().toISOString().slice(0, 10)` — `toISOString()` sempre normaliza pra UTC, então de ~21h em diante (horário de Brasília, UTC-3) esse cálculo silenciosamente dava o dia **seguinte**, não hoje. Um lançamento feito às 22h de um dia ficava registrado no dia seguinte sem nenhum aviso. Novo helper único `lib/today.ts` (`todayDateString`, usando o fuso `America/Sao_Paulo` explicitamente, igual ao que `lib/server/clock.ts` já fazia só no servidor) substitui todas as ocorrências, no cliente e no servidor.

### Impacto

- Lançamentos já salvos com a data errada (um dia à frente) não são corrigidos automaticamente por esta mudança — pedem correção manual nos casos identificados.

## [03/09/2026 - 21:51]

### Adicionado

- Ação "Editar total" na fatura (`/cards/[id]`) quando o total foi lançado manualmente (`manualTotalCents`, via "Lançar fatura já existente") — antes só dava pra somar um ajuste em cima (juros/tarifa/estorno) pelo botão "Ajustar", sem forma de corrigir o valor errado direto. Reaproveita a mesma ação `enterPastInvoice` (upsert por cartão+mês), só muda o rótulo/título do modal e pré-preenche com o valor atual.

### Corrigido

- Um mês sem nenhum lançamento e sem total manual (ex.: a fatura do ciclo atual, ainda vazia) aparecia como "Fatura paga" — a tela só checava se existia uma linha de `Invoice`, sem checar se havia algo pra pagar (fatura com total R$ 0,00 sempre fecha em "outstanding = 0"). Isso fazia o botão "Desfazer pagamento" parecer sem efeito (não tinha pagamento nenhum pra desfazer) e o mês atual, ao abrir a tela do cartão, parecer com algo quebrado. Agora esse caso mostra a mesma ação de lançar fatura, igual a um mês sem `Invoice` nenhuma.

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
