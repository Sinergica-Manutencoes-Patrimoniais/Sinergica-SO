---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Relatório de Inspeção: revisão em lote (IA GUT/esforço/embasamento, backlog ou descarte)

> Tier pequeno-médio. Reusa Edge Function/prompt já existente (E01-S105) — nenhum prompt/IA novo.
> Migration aditiva em `pcm.inspecao_itens`. Supersede E01-S141 (mantém código, muda fluxo principal).

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Migration: `gravidade`/`urgencia`/`tendencia`/`esforco_horas`/`justificativa_esforco`/`citacao_normativa` em `pcm.inspecao_itens`; `destino` aceita `'descarte'` | AC-2,AC-5,AC-6 | leitura de SQL | done |
| 2 | Domínio: `DestinoItemAssessment` + `"descarte"`; `DESTINO_ITEM_LABEL` | AC-6 | typecheck | done |
| 3 | `InspecaoItem`/`mapItem`/`ITEM_COLS`: novos campos GUT/esforço/citação | AC-4,AC-5,AC-6 | typecheck | done |
| 4 | Application `qualidade.ts`: `atualizarResultadoItem` (resultado inline), `descartarItem` | AC-1,AC-2 | vitest | done |
| 5 | Application: `montarTextoParaClassificacaoDeItens` (mesmo formato do parser de planilha) + `parearClassificacaoComItens` (índice a índice, fallback 3/3/3 em desalinhamento) | AC-4 | vitest | done |
| 6 | UI: botões de resultado inline no `ItemInspecaoCard` | AC-1 | typecheck | done |
| 7 | UI: seleção local pra backlog + "Descartar" + selos "No backlog"/"Descartado" | AC-2,AC-6 | typecheck | done |
| 8 | UI: barra "Gerar backlog (N)" + modal de revisão (GUT/esforço/citação editáveis, Score PCM calculado) | AC-3,AC-4 | typecheck | done |
| 9 | UI: confirmar grava GUT/esforço/citação no item + `derivarItemParaOsOuBacklog` por item (gravidade/urgência/tendência reais, `observacao` com esforço+justificativa+citação, `tipoTarefaId` default do primeiro tipo, `tecnicoId` null) | AC-5 | typecheck | done |

## Plano de teste
- Unidade: `montarTextoParaClassificacaoDeItens`/`parearClassificacaoComItens` — pareamento por
  índice, fallback em desalinhamento de contagem.
- Unidade: `descartarItem`/`atualizarResultadoItem` — chamam o gateway certo, validam `destino`.
- Aceite manual (dev server): marcar 2 itens pra backlog, "Gerar backlog", revisar/editar GUT,
  confirmar, ver "No backlog" no card e a OS aparecendo em Chamados/OS → Backlog.

## Divergências (SPEC_DEVIATION)
- Nenhuma até aqui — "Decisão de escopo" (esforço/citação em `observacao` da OS, não coluna nova)
  já documentada na spec como decisão, não como divergência.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] typecheck/vitest/biome locais verdes
- [ ] ROADMAP.md + STATE.md atualizados
- [ ] Migration revisada por Lucas antes de produção (mesmo processo da S142)
