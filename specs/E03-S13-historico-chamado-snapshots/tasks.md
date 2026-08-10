---
name: tasks
description: Decomposição e gates — confirmar o Atendimento como dono de historico_chamado_snapshots e documentar o critério.
alwaysApply: false
---

# Tasks — E03-S13 · `historico_chamado_snapshots`: confirmar dono e documentar

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S13-historico-chamado-snapshots`. Story **trivial**, sem migration de schema.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Reler `0136_E01-S89_historico_chamado_snapshots.sql` e os dois adapters que a leem (`features/pcm/infrastructure/supabase-chamados-adapter.ts:289`, `features/atendimento/infrastructure/supabase-historico-chamado-adapter.ts:122,142`) e confirmar: nenhuma feature importa código da outra, só a tabela é compartilhada | AC-3 | — | leitura + anotação nesta tabela | todo |
| 2 | Migration `NNNN_E03-S13_comment_dono_snapshots.sql`: **só `comment on table`** registrando que o dono é o Atendimento (produz o dado), que o PCM lê sob RLS própria, e apontando o ADR-0019 | AC-1, AC-4 | 1 | `pnpm run lint:migrations` | todo |
| 3 | `ARCHITECTURE.md`: remover a tabela do item 4 da "Dívida de fronteira"; registrá-la como Core do Atendimento, com a nota de que o épico da story (E01) difere do dono do dado | AC-1 | 2 | `pnpm run audit:esteira` | todo |
| 4 | `ADR-0019`: acrescentar ao corolário o critério que faltava — **épico de origem da story não determina o dono**; usar este caso como exemplo documentado de reclassificação | AC-2 | 3 | `pnpm run audit:esteira` | todo |
| 5 | `pnpm run ci:local` + ROADMAP/STATE atualizados (marcar a story como reclassificada, não como correção de dívida) | todos | 1–4 | `pnpm run ci:local` | todo |

## Plano de teste
- Sem teste de comportamento: nada muda em runtime (AC-4). Os gates são `lint:migrations`,
  `audit:esteira` e `ci:local`.
- Conferir que nenhuma outra tabela do mapa foi classificada pelo mesmo erro (épico ≠ dono) — se
  houver, registrar no ROADMAP em vez de corrigir aqui.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Alguém no futuro "corrigir" movendo a tabela | O `comment on table` (task 2) e o ADR (task 4) deixam a decisão explícita no próprio banco |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] `pnpm run ci:local` verde
- [ ] `ARCHITECTURE.md`: item 4 da "Dívida de fronteira" removido · ADR-0019 com o critério novo
- [ ] ROADMAP/STATE atualizados
