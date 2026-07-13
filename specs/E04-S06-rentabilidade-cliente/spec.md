---
name: spec
description: Contrato — rentabilidade por cliente/contrato: custo/hora por funcionário, custo real por OS (horas Auvo + despesas), margem mensal e alerta de margem negativa.
alwaysApply: true
---

# Spec — E04-S06 · Rentabilidade por cliente/contrato (ganho = receita − custo real)

> **Fonte da verdade.** Status: pronto para implementar · Tier: médio
> **Depende de: E04-S01** (lançamentos/clientes) e **E04-S04** (contratos/receita recorrente).
> Design do épico: `specs/E04-S01-fundacao-financeiro/design.md` (§S06). Decisão do PO
> (2026-07-13): custo/hora **por funcionário** (custo mensal ÷ horas-base). É a dor L2 do
> ESCOPO-MESTRE ("não sei se o contrato dá lucro") — o indicador que muda o jogo (D3).

## Resumo
Fecha o ciclo: cadastro de custo mensal por funcionário (com histórico de vigência) → custo real
por OS = horas de campo (do Auvo, já sincronizadas) × R$/h do funcionário + despesas de campo
(`pcm.despesas`) → consolidação por cliente/mês contra a receita (contrato + avulsos) → margem,
com alerta de 2 meses consecutivos negativos (regra do blueprint). Tela com ranking de clientes
por margem e drill-down até a OS.

## Contexto de dados (verificado em 2026-07-13 — reverificar antes de codar)
- **Horas por OS:** `pcm.ordens_servico.auvo_detalhes` (jsonb, populado desde E01-S38/S44;
  ~2.177 OS com duração em produção). **Task 1 obrigatória: confirmar as chaves reais do jsonb**
  (duração/check-in/check-out) por query read-only antes de escrever a view — não inventar nome de
  campo (lição E01-S34: era `taskID`, não `id`).
- **Funcionário da OS:** `pcm.ordens_servico` tem vínculo com técnico (FK validada em `0071`);
  OS sem técnico atribuído entra no custo como "não atribuído" (aparece, não some).
- **Despesas:** `pcm.despesas.valor_centavos` por `auvo_task_id`. O endpoint Auvo `/expenses`
  respondia **500 server-side** (chamado com suporte Auvo pendente desde 2026-07-11) — a tabela
  pode estar vazia; tratar como custo 0 **com aviso honesto na UI** ("despesas de campo ainda sem
  sincronização"), nunca como erro nem silêncio.
- **Receita:** lançamentos de entrada realizados por cliente (S01) + recebíveis de contrato (S04).

## Critérios de aceite

### AC-1: Custo por funcionário com vigência
- **Dado** um usuário com `financeiro='escrita'`
- **Quando** cadastra o custo de um funcionário (custo mensal em centavos, horas-base/mês —
  default 220, vigente desde)
- **Então** o R$/h derivado aparece na tela de Custos de Pessoal; um novo registro com
  `vigente_desde` posterior passa a valer daquele mês em diante sem reescrever o passado

### AC-2: Custo real por OS
- **Dado** uma OS com horas de campo e/ou despesas vinculadas
- **Quando** o custo da OS é calculado (view/RPC)
- **Então** custo = Σ(horas × R$/h do funcionário na vigência da data da OS) + Σ(despesas da
  task); OS sem horas nem despesas mostra custo 0 explícito ("sem dados de campo"), distinto de
  erro

### AC-3: Rentabilidade por cliente/mês
- **Dado** receita e custo de um cliente numa competência
- **Quando** a tela de Rentabilidade carrega (view `financeiro.rentabilidade_cliente_mes`)
- **Então** mostra por cliente: receita, custo (MO + despesas), margem R$ e margem %, nos últimos
  12 meses, com ranking (melhor → pior) e totais da carteira

### AC-4: Alerta de margem negativa
- **Dado** um cliente com margem < 0 em 2 meses consecutivos fechados
- **Quando** a tela carrega
- **Então** o cliente ganha destaque de alerta "revisar contrato" (regra do blueprint
  `04-financeiro.md`); mês corrente (incompleto) não dispara o alerta

### AC-5: Drill-down por OS
- **Dado** um cliente na tela de Rentabilidade
- **Quando** o usuário expande um mês
- **Então** vê as OS do período com horas, funcionário(s), R$/h aplicado, despesas e custo por OS
  — rastreável até a origem do número

### AC-6: Honestidade dos dados parciais
- **Dado** funcionário sem custo cadastrado ou OS sem técnico
- **Quando** aparecem no cálculo
- **Então** as horas entram como "não valoradas" (contadas à parte, visíveis), nunca custo 0
  silencioso — o total indica cobertura (ex.: "92% das horas valoradas")

## Fora de escopo
> Vinculante.
- Rateio de custos administrativos/overhead por cliente (V1 = custo direto; overhead é evolução).
- Custo de deslocamento por km (sem endpoint público no Auvo — auditoria 2026-07-10; GPS é
  E01-S52, correlação futura).
- Materiais de estoque (módulo E05 não existe; quando existir, soma aqui).
- Precificação/simulação de proposta (Comercial E03; ver "Volante" no glossário).

## Rastreabilidade
- Origem: pedido do PO ("ganho do cliente considerando gastos de hora × valor recebido") +
  ESCOPO-MESTRE §6.5 (Custo & Rentabilidade, margem, alerta 2 meses) + blueprint
  `04-financeiro.md` (`CustoOS`, `RentabilidadeContrato`) + E01-S54 (primeiro tijolo, despesas).
- Tabela/views: `financeiro.custos_funcionario`, `rentabilidade_cliente_mes` — contrato em
  `specs/E04-S01-fundacao-financeiro/design.md` §S06.
- Arquivos-âncora: `pages/RentabilidadePage.tsx`, `pages/CustosPessoalPage.tsx`,
  `domain/rentabilidade.ts`, migration nova; fontes PCM: `pcm.ordens_servico.auvo_detalhes`,
  `pcm.despesas`, `pcm.funcionarios`.
