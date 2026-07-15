---
name: spec
description: Contrato — apontamento de horas por OS derivado do Auvo (check-in/out/duração), ligado a técnico e cliente, com visão de horas e custo por cliente. Insumo de rentabilidade (E04-S06).
alwaysApply: true
---

# Spec — E01-S72 · Apontamento de horas + custo por cliente

> **Fonte da verdade.** Status: pronto para implementar · Tier: médio
> Origem: teste de produção do Lucas (2026-07-14) — "a parte de apontamento de horas do Auvo
> precisamos trazer para o PCM, pois a partir dele linkamos com as tarefas, com o cliente, com o
> funcionário e damos uma visão de gastos com aquele cliente".

## Achado técnico (verificado na API Auvo real + auditoria)
**Não há endpoint público de apontamento de horas no Auvo** (`docs/AUDITORIA-AUVO-API.md:65-67` —
só relatório de UI). MAS o `GET /tasks` já traz por tarefa: `checkInDate`, `checkOutDate`,
`duration` ("HH:MM:SS"), `durationDecimal` (horas decimais) e `timeControl`. Esses dados já são
gravados em `pcm.ordens_servico` (`check_in_at`/`check_out_at`) e `auvo_detalhes`
(`duracao`/`duracaoHoras`). **Então a visão de horas é derivável localmente** — cada OS já tem
técnico (`tecnico_funcionario_id`, FK validada em `0071`) e cliente. Sem sync novo do Auvo.
> Pré-requisito: E01-S68 (timezone) — sem ela, check-in/out estão 3h errados e o cálculo de horas
> por dia sai distorcido.

## Resumo
Uma view/RPC que agrega horas por OS (a partir de `check_in_at`/`check_out_at`/`durationDecimal`),
junta técnico e cliente, e permite ver horas por cliente/técnico/período. Tela "Apontamento de
Horas" no PCM. Ponte com Financeiro: quando `custos_funcionario` (E04-S06) existir, multiplica horas
× R$/h para custo; sem ela, mostra só horas.

## Critérios de aceite

### AC-1: Horas por OS
- **Dado** OS sincronizadas do Auvo com check-in/out e/ou duração
- **Quando** a visão de horas é montada (view/RPC `pcm.fn_apontamento_horas` ou similar,
  `security invoker`)
- **Então** cada OS aparece com horas trabalhadas (preferir `durationDecimal`; senão
  `check_out_at − check_in_at`), técnico e cliente. OS sem dado de horas aparece com 0/“sem
  apontamento”, não some

### AC-2: Agregação por cliente e técnico
- **Dado** um período selecionado
- **Quando** o usuário agrupa por cliente (ou por técnico)
- **Então** vê o total de horas por cliente e por técnico no período — a "visão de gastos com aquele
  cliente" pedida (horas; custo quando E04-S06 existir)

### AC-3: Tela de apontamento
- **Dado** o módulo PCM
- **Quando** o usuário abre "Apontamento de Horas"
- **Então** lista as horas por OS com filtros (período, técnico, cliente) e os totais agregados;
  gate `pcm:leitura`

### AC-4: Ponte com custo (opcional/condicional)
- **Dado** `financeiro.custos_funcionario` existente (E04-S06 implementada)
- **Quando** a visão calcula custo
- **Então** custo = horas × R$/h da vigência do funcionário; se E04-S06 não existir, a tela mostra
  só horas com nota "custo disponível quando o módulo Financeiro estiver ativo"

## Fora de escopo
> Vinculante.
- Sync novo de horas do Auvo (não há endpoint; deriva-se do que já temos).
- Km rodado / deslocamento (sem endpoint; GPS é E01-S52).
- Rentabilidade completa por contrato — E04-S06 (esta story fornece as horas que alimentam aquela).

## Rastreabilidade
- Origem: teste Lucas 2026-07-14; auditoria confirma ausência de endpoint de horas.
- **Depende de: E01-S68** (timezone correto no check-in/out).
- Arquivos-âncora: migration nova (view/RPC de apontamento), `pcm.ordens_servico`
  (`check_in_at`/`check_out_at`/`tecnico_funcionario_id`/`auvo_detalhes.duracaoHoras`),
  nova `apps/web/src/features/pcm/pages/ApontamentoHorasPage.tsx` + domain/application/adapter,
  item na sidebar PCM (`HomePage.tsx`).
- Conecta com: `specs/E04-S06-rentabilidade-cliente/` (`financeiro.custos_funcionario`).
