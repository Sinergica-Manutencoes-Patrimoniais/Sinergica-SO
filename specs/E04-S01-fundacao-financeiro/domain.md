---
name: domain
description: Modelo de domínio DDD do bounded context Financeiro — linguagem ubíqua, agregados, eventos e relações com PCM/Comercial.
alwaysApply: false
---

# Domain Model (DDD) — Financeiro

## Bounded Context
**Financeiro** (`financeiro`) — subdomínio **de suporte** (o core é o PCM). Novo bounded context:
este é o primeiro story que cria tabelas no schema. Nenhum outro contexto escreve em `financeiro.*`;
o Financeiro **lê** de `pcm.*` (clientes, funcionários, OS, despesas) e nunca escreve lá.

## Linguagem ubíqua (adicionada ao `docs/glossary.md` no mesmo PR)
| Termo | Definição | NÃO confundir com |
|-------|-----------|-------------------|
| **Lançamento** | Movimento financeiro único (entrada ou saída), com categoria, competência e valor em centavos. Ciclo: `previsto → realizado → conciliado`. | Transação de extrato (linha importada do banco, ainda não classificada) |
| **Competência** | Mês a que o lançamento pertence economicamente (`data_competencia`), independente de quando o dinheiro se moveu (`data_pagamento`). | Data de vencimento (quando deveria ser pago) |
| **Plano de contas** | Árvore de categorias (2 níveis) que classifica todo lançamento como um tipo de entrada ou saída. | Conta bancária (onde o dinheiro está) |
| **Conciliação** | Vínculo 1:1 entre uma transação do extrato importado e um lançamento. Lançamento conciliado é imutável até desfazer o vínculo. | Baixa (marcar previsto como realizado — pode ocorrer sem extrato) |
| **FITID** | Identificador único da transação dentro do OFX, atribuído pelo banco. Chave de dedupe: reimportar o mesmo arquivo não duplica nada. | `id` interno da transação no schema |
| **Baixa** | Transição `previsto → realizado` de um lançamento (recebimento/pagamento confirmado), com `data_pagamento`. | Conciliação (exige extrato) |
| **Recebível** | Lançamento de entrada `previsto` gerado por contrato (recorrente) ou avulso, com vencimento. | Fatura/NF-e (documento fiscal — fora do V1) |
| **Aging** | Distribuição dos recebíveis vencidos por faixa de atraso (D+3 / D+7 / D+15+). | DSO |
| **DSO** | Days Sales Outstanding — prazo médio (dias) entre vencimento e recebimento efetivo. | Aging (foto do atraso atual) |
| **Contrato (Financeiro)** | Cadastro de receita recorrente por cliente: valor mensal, vigência, dia de vencimento. Fonte da previsão de receita até o módulo Comercial (E03) existir. | Contrato PMOC (vínculo legal do PCM) · Proposta (Comercial) |
| **Recorrência** | Despesa fixa mensal (aluguel, salários, software) que gera lançamento de saída previsto todo mês. | Contrato (lado da receita) |
| **Custo/hora de funcionário** | `custo_mensal ÷ horas_mes_base` da vigência aplicável — valoriza as horas de OS no cálculo de rentabilidade. | Preço/hora cobrado do cliente |
| **Posição de caixa** | Soma dos saldos das contas ativas (saldo inicial + realizados) numa data; projetada = posição + previstos até o horizonte. | Resultado do mês (entradas − saídas do período) |

## Agregados, entidades e value objects
- **Lançamento** (agregado raiz) — invariantes: `valor_centavos > 0` (o sinal é o `tipo`);
  `previsto` exige `data_vencimento`; `realizado` exige `data_pagamento`; conciliado (com
  `extrato_transacao_id`) bloqueia exclusão e mudança de valor/conta até desconciliar; máx. 2
  níveis de categoria.
- **Categoria** — árvore de 2 níveis; um nível-2 herda o `tipo` do pai; desativar (`ativo=false`)
  em vez de excluir quando houver lançamentos.
- **ContaBancaria** — saldo atual é **derivado** (saldo inicial + Σ realizados na conta desde
  `saldo_inicial_em`), nunca coluna gravada.
- **TransaçãoExtrato** (S02) — imutável após importada; estados `pendente → conciliado` ou
  `pendente → ignorado` (reversíveis); `unique (conta_id, fitid)`.
- **Contrato** (S04) e **Recorrência** (S05) — fábricas de lançamentos previstos; geração
  idempotente por (origem, competência).
- **CustoFuncionario** (S06) — VO versionado por `vigente_desde`; a vigência aplicável a uma data
  é a de maior `vigente_desde ≤ data`.

## Eventos de domínio (conceituais — sem event bus no V1)
| Evento | Disparado quando | Quem reage |
|---|---|---|
| `LancamentoRegistrado` | insert manual/import/recorrência | dashboard (agregados via RPC) |
| `LancamentoBaixado` | `previsto → realizado` | posição de caixa, aging |
| `TransacaoConciliada` | vínculo extrato ↔ lançamento | trava o lançamento; some da fila de pendentes |
| `RecebiveisGerados` | RPC de recorrência roda para uma competência | contas a receber do mês aparecem |
| `MargemNegativaDetectada` | view de rentabilidade fecha 2 meses consecutivos < 0 para um cliente | alerta visual na tela de rentabilidade (S06) |

## Relações com outros contextos (context map)
- **PCM → Financeiro: fornecedor de dados (Conformist).** Financeiro lê `pcm.clientes`,
  `pcm.funcionarios`, `pcm.ordens_servico` (horas), `pcm.despesas` — read-only, via FK/joins.
- **Financeiro → Gestão/Cockpit (E08): fornecedor.** O caixa do Cockpit será view sobre
  `financeiro.*` (ESCOPO-MESTRE §6.8) — nomes de tabela/coluna deste design são contrato público
  interno; renomear depois exige migration coordenada.
- **Financeiro → Área do Cliente (E09): fornecedor futuro.** Views dedicadas para
  `cliente-sindico` (faturas próprias, status) — decisão D5; nada criado agora.
- **Comercial (E03): sucessor futuro** do cadastro de contratos (ver design D-5).
