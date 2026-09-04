# Changelog

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
