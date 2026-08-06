---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Relatório diário da operação (base pro Fabricio)

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 5). "Crie relatórios diários sobre a
> operação, seja criativo, será base pro Fabricio ver o que aconteceu durante o dia."
> Decisão travada: **sob demanda — tela + PDF de qualquer dia** (não é o cron/snapshot).

## Contexto de código
- Dado disponível: `pcm.ordens_servico` (status/datas/técnico/cliente), `pcm.chamados`
  (intake/origem), apontamento de horas (E01-S72/S77), Agenda do Técnico (E01-S104/S112), Saúde Auvo
  (`pcm.auvo_sync_health`, E00-S11/E01-S123), backlog GUT.
- Reusa agregações já existentes (`hub-os`, `dashboard-pcm`, `calcularMetricasOperacao` E01-S118) e
  o gerador PDF `pdf-lib` (laudo PMOC E01-S05). Complementa o relatório de planejamento (E01-S126),
  que é lista por técnico/dia — este é um **resumo gerencial do dia**.

## Resumo
Uma tela "Relatório do Dia" onde o Fabricio escolhe uma data e vê um **resumo do que aconteceu** na
operação naquele dia: o que abriu, o que fechou, quem trabalhou, o que atrasou, saúde do sync.
Exporta em PDF. Foco em leitura rápida de gestão — creativo mas objetivo.

## Seções propostas (criativo — ajustável)
- **Cabeçalho:** data, gerado em, por quem.
- **Resumo do dia (números):** OS abertas, OS finalizadas, chamados novos, itens pro backlog,
  emergenciais (C1), % planejado x executado.
- **Por técnico:** horas apontadas, OS tocadas, o que executou (link Auvo de evidência quando houver).
- **Atenção:** OS atrasadas/sem técnico, chamados sem tratativa, erros de sync Auvo (E01-S123).
- **Movimento do backlog:** entrou/saiu, top GUT do dia.

## Critérios de aceite

### AC-1: Escolher o dia e ver o resumo
- **Dado** a tela Relatório do Dia
- **Quando** o Fabricio escolhe uma data
- **Então** vê o resumo da operação daquele dia (números + por técnico + atenção + backlog),
  legível de cima a baixo.

### AC-2: Números corretos do dia
- **Dado** um dia com movimento conhecido
- **Quando** o relatório monta
- **Então** os contadores batem com o dado real (OS abertas/finalizadas, chamados, horas) daquele
  recorte de data.

### AC-3: Exportar PDF
- **Dado** um relatório gerado
- **Quando** o Fabricio clica "Exportar PDF"
- **Então** baixa um PDF formatado com o mesmo conteúdo.

### AC-4: Dia sem movimento
- **Dado** uma data sem operação
- **Quando** o relatório monta
- **Então** mostra "Sem movimento neste dia" com clareza, sem seções quebradas nem PDF enganoso.

## Casos de borda e erros
- Fuso/limite de dia: usar o dia local (pt-BR), consistente com o resto do PCM.
- Técnico/cliente sem nome: fallback, sem furo.
- Saúde Auvo indisponível: seção "Atenção" degrada, não derruba o relatório.

## Fora de escopo
- Geração automática diária / snapshot persistido / envio (decisão: sob demanda). Fica pra story
  futura se quiserem o cron.
- Relatório voltado ao cliente (é a E01-S135).

## Rastreabilidade
- Código: nova `pages/RelatorioDiarioPage.tsx` (grupo RELATÓRIOS), `domain/relatorio-diario.ts`
  (agregação pura testável), `application/*`, adapters (`hub-os`/`dashboard-pcm`/apontamento/saúde),
  gerador PDF (`pdf-lib`).
- Reusa: E01-S118 (`calcularMetricasOperacao`), E01-S126 (planejamento/execução), E01-S123 (saúde).
- ADRs relacionados: —
