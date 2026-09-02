# Runbook de importação CSV — Gadgetzan

Este documento é o contrato completo para quem vai transformar uma planilha (ou qualquer outra fonte de histórico financeiro) nos arquivos CSV que o Gadgetzan importa. Ele foi escrito para ser lido **sem acesso ao código do app** — se algo aqui parecer ambíguo, prefira ser mais conservador (deixe a linha de fora, ou marque como dúvida) a inventar um valor.

Depois que os arquivos estiverem prontos, o fluxo dentro do app é:

1. Upload de um ou mais arquivos em **Importações → Nova importação**.
2. **Validar** — o app confere cada linha e mostra um relatório (o que está ok, o que tem erro, o que será pulado). Nada é gravado nessa etapa.
3. **Confirmar importação** — só grava se não houver erros.
4. Depois de confirmado: o lote aparece em **Importações**, pode ser **baixado de volta em CSV** (para conferência linha a linha contra a fonte original) ou **desfeito** (remove tudo que aquele lote criou).

Isso significa que erros de formatação serão pegos e mostrados antes de qualquer coisa ser gravada — mas quanto mais limpo o CSV chegar, menos idas e vindas.

## Regras gerais (valem para todos os arquivos)

- **Formato:** CSV com `;` (ponto e vírgula) como separador — nunca vírgula, porque os valores monetários usam vírgula decimal.
- **Codificação:** UTF-8. Um BOM no início do arquivo (comum quando se exporta do Excel) é tolerado.
- **Cabeçalho:** a primeira linha é sempre o cabeçalho, com os nomes de coluna exatamente como listados abaixo (minúsculas, sem acento nos nomes das colunas — os *valores* podem ter acento à vontade).
- **Datas:** sempre `AAAA-MM-DD` (ex.: `2026-08-20`). **Nunca** `DD/MM/AAAA` — isso será rejeitado, não "adivinhado".
- **Valores monetários:** sempre `123,45` — vírgula decimal, exatamente duas casas, **sem** separador de milhar (ou seja, `1234,56`, não `1.234,56` e não `1234.56`). Sempre positivos.
- **`id_externo` é obrigatório em toda linha de todo arquivo.** É o que permite reenviar um CSV corrigido sem duplicar o que já foi importado: se um `id_externo` já existe no sistema, aquela linha (ou grupo de linhas, no caso de parcelas — ver abaixo) é simplesmente pulada, com aviso, e o resto do lote segue normal.
  - Gere-o de forma **estável e determinística** a partir da própria fonte — por exemplo `nubank-cartao-2026-08:L42` (aba + linha da planilha) — nunca a partir do conteúdo (descrição/valor), porque se a linha for corrigida depois o id não pode mudar.
  - Tem que ser único dentro de cada arquivo e entre arquivos diferentes do mesmo lote.
- **Nomes (categoria, conta, cartão, investimento, porquinho) têm que bater exatamente** com o que já existe cadastrado no Gadgetzan — mesma grafia, mesmos acentos, mesma capitalização. Nada é criado automaticamente. **Antes de preparar os arquivos, confira a lista exata de nomes já cadastrados** (contas em `/accounts`, cartões em `/cards`, categorias em `/settings`, investimentos em `/investments`, porquinhos em `/goals`) e use exatamente esses nomes.
- Uma linha com algum campo claramente errado (data em formato errado, valor com formato errado, nome que não bate com nada) **não trava o arquivo inteiro** — ela aparece como erro no relatório de validação, e o resto das linhas segue sendo avaliado.
- Todo arquivo é **opcional** — suba só os que tiver naquele lote. Pelo menos um arquivo com pelo menos uma linha válida é necessário para confirmar.

## Antes de começar: verifique a data de abertura das contas

Toda conta no Gadgetzan tem uma data de abertura (`openingDate`) e um saldo naquela data (`openingBalance`). **Nenhuma linha pode ter uma data anterior à data de abertura da conta que ela referencia** — isso é bloqueado na validação (para não corromper silenciosamente o saldo histórico da conta).

Se você vai importar histórico de meses/anos atrás, ajuste primeiro a data e o saldo de abertura de cada conta envolvida (editando a conta em `/accounts/[id]`) para uma data anterior a tudo que será importado, com o saldo real que a conta tinha **naquela data** — não o saldo de hoje. Veja `docs/agents/02-business-rules.md` R12 para a fórmula completa do saldo.

## Compras parceladas em andamento — a parte mais importante

Se uma compra no cartão já está parcialmente paga (por exemplo, você está na parcela 2 de 4), **não** tente reconstruir a compra inteira desde a parcela 1. Preencha:

- `parcela_atual`: o número da parcela atual (ex.: `2`)
- `total_parcelas`: o total de parcelas (ex.: `4`)
- `valor`: o valor **dessa** parcela
- `data`: a data/mês dessa parcela atual

O Gadgetzan vai criar **apenas as parcelas que faltam** — a atual e as futuras (no exemplo, 2, 3 e 4 — três lançamentos), uma por mês, repetindo o mesmo valor. Ele **não** tenta descobrir quanto foi a parcela 1 nem quando a compra foi feita originalmente — isso já aconteceu e não muda nenhuma projeção futura. O que importa é que as parcelas que ainda vão vencer existam no sistema, para o limite disponível do cartão e as faturas futuras ficarem corretos.

Se a compra já foi **totalmente paga** (não tem parcela em aberto), ou se é uma compra à vista, deixe `parcela_atual`/`total_parcelas` em branco — ela entra como uma despesa simples.

## Arquivos

### `despesas.csv`

Compras e gastos — no débito/pix (`metodo=conta`) ou no cartão (`metodo=cartao`).

| Coluna | Obrigatório | Formato | Notas |
| --- | --- | --- | --- |
| `id_externo` | sim | texto | ver regras gerais |
| `data` | sim | `AAAA-MM-DD` | data da compra (ou da parcela atual, se parcelada) |
| `descricao` | sim | texto | |
| `valor` | sim | `123,45` | valor da compra (ou da parcela atual) |
| `categoria` | sim | texto | precisa existir |
| `metodo` | sim | `conta` ou `cartao` | |
| `conta` | se `metodo=conta` | texto | precisa existir |
| `cartao` | se `metodo=cartao` | texto | precisa existir |
| `parcela_atual` | não | inteiro ≥ 1 | ver seção acima — só para `metodo=cartao` |
| `total_parcelas` | não | inteiro ≥ `parcela_atual` | preencher junto com `parcela_atual` |
| `nota` | não | texto | |

```
id_externo;data;descricao;valor;categoria;metodo;conta;cartao;parcela_atual;total_parcelas;nota
nubank-conta-ago:L12;2026-08-05;Mercado;385,40;Alimentação;conta;Nubank;;;;
nubank-cartao-ago:L03;2026-08-20;Vôo REC-RJ;368,08;Viagem;cartao;;Cartão Nubank;2;4;
inter-cartao-ago:L07;2026-08-11;Academia;89,90;Cuidados Pessoais;cartao;;Cartão Inter;;;
```

### `receitas.csv`

| Coluna | Obrigatório | Formato | Notas |
| --- | --- | --- | --- |
| `id_externo` | sim | texto | |
| `data` | sim | `AAAA-MM-DD` | |
| `descricao` | sim | texto | |
| `valor` | sim | `123,45` | |
| `categoria` | sim | texto | precisa existir (ex.: "Salário", "Outras receitas") |
| `conta` | sim | texto | conta que recebeu o valor |
| `nota` | não | texto | |

```
id_externo;data;descricao;valor;categoria;conta;nota
nubank-conta-ago:L01;2026-08-05;Salário;8500,00;Salário;Nubank;
```

### `transferencias.csv`

Movimentações entre suas próprias contas — inclusive quando o motivo é antecipar o pagamento de uma fatura (nesse caso, é uma transferência da conta para a conta que paga o cartão; o pagamento da fatura em si vai em `faturas.csv`, ver abaixo).

| Coluna | Obrigatório | Formato | Notas |
| --- | --- | --- | --- |
| `id_externo` | sim | texto | |
| `data` | sim | `AAAA-MM-DD` | |
| `valor` | sim | `123,45` | |
| `conta_origem` | sim | texto | |
| `conta_destino` | sim | texto | diferente de `conta_origem` |
| `nota` | não | texto | |

```
id_externo;data;valor;conta_origem;conta_destino;nota
inter-conta-ago:L20;2026-08-15;1000,00;Inter;Nubank;Reforço pra fatura do Nubank
```

### `investimentos.csv`

Aportes e resgates de investimentos (não confundir com porquinhos — ver abaixo).

| Coluna | Obrigatório | Formato | Notas |
| --- | --- | --- | --- |
| `id_externo` | sim | texto | |
| `data` | sim | `AAAA-MM-DD` | |
| `valor` | sim | `123,45` | |
| `investimento` | sim | texto | precisa existir |
| `conta` | sim | texto | conta de onde saiu/pra onde entrou o dinheiro |
| `direcao` | sim | `entrada` ou `saida` | `entrada` = aporte, `saida` = resgate |
| `nota` | não | texto | |

```
id_externo;data;valor;investimento;conta;direcao;nota
inter-conta-ago:L25;2026-08-10;500,00;Tesouro Selic;Inter;entrada;
```

### `porquinhos.csv`

Aportes e resgates de metas/reservas ("porquinhos"). Isso **não move dinheiro de verdade** entre contas — é uma reserva lógica sobre um saldo que já existe (ver `docs/agents/02-business-rules.md` R9).

| Coluna | Obrigatório | Formato | Notas |
| --- | --- | --- | --- |
| `id_externo` | sim | texto | |
| `data` | sim | `AAAA-MM-DD` | |
| `valor` | sim | `123,45` | |
| `porquinho` | sim | texto | precisa existir |
| `direcao` | sim | `entrada` ou `saida` | `entrada` = guardar, `saida` = resgatar |
| `nota` | não | texto | |

```
id_externo;data;valor;porquinho;direcao;nota
nubank-conta-ago:L30;2026-08-06;300,00;Viagem de fim de ano;entrada;
```

### `faturas.csv`

Duas coisas diferentes nesse arquivo, distinguidas por `tipo`:

- **`pagamento`** — você pagou (total ou parcialmente) a fatura de um cartão, de uma conta.
- **`ajuste`** — juros, multa, estorno lançado direto na fatura, sem uma compra por trás.

| Coluna | Obrigatório | Formato | Notas |
| --- | --- | --- | --- |
| `id_externo` | sim | texto | |
| `data` | sim | `AAAA-MM-DD` | data do pagamento/ajuste |
| `cartao` | sim | texto | precisa existir |
| `mes_fatura` | sim | `AAAA-MM` | mês de referência da fatura (o mês de vencimento, não o de compra) |
| `tipo` | sim | `pagamento` ou `ajuste` | |
| `valor` | sim | `123,45` | valor pago (ou valor do ajuste) |
| `conta` | se `tipo=pagamento` | texto | de onde saiu o dinheiro |
| `descricao` | se `tipo=ajuste` | texto | motivo do ajuste (juros, multa, estorno...) |
| `categoria` | se `tipo=ajuste` | texto | |
| `nota` | não | texto | |

```
id_externo;data;cartao;mes_fatura;tipo;valor;conta;descricao;categoria;nota
nubank-conta-ago:L18;2026-08-10;Cartão Nubank;2026-08;pagamento;2340,00;Nubank;;;
inter-conta-jul:L22;2026-07-15;Cartão Inter;2026-07;ajuste;35,00;;Juros por atraso;Outros;
```

**Importante:** se você está importando despesas de cartão de um período, importe também **todos os pagamentos de fatura desse período** (mesmo os antigos, já quitados há muito tempo). Se uma fatura antiga nunca receber um `pagamento` correspondente, o Gadgetzan vai continuar contando ela como "em aberto" para sempre, e isso reduz permanentemente o limite disponível do cartão mostrado no app — mesmo que na vida real ela já esteja paga.

## Sobre desfazer e reimportar

Se algo saiu errado depois de confirmado, use **Desfazer** no lote (em `/imports/[id]`) — isso apaga tudo que aquele lote criou e recalcula o que for necessário (faturas, limites). Depois é só corrigir o CSV e subir de novo — as linhas com `id_externo` que já tinham sido importadas antes do desfazer **não** vão colidir, porque o desfazer as removeu de verdade.

Se você só quer corrigir uma compra parcelada específica sem desfazer o lote inteiro, saiba que ela ocupa `id_externo` sufixado por parcela (`${id_externo}#2`, `${id_externo}#3`...) — mudar `total_parcelas` numa reimportação muda esses sufixos, então a forma segura de corrigir é desfazer o lote (ou pelo menos identificar essas linhas) antes de reenviar.
