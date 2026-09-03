# Changelog

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
