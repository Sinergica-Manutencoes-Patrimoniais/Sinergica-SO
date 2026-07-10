---
name: tasks
description: Decomposição e gates — tipos de tarefa reais no modal de Nova OS.
alwaysApply: false
---

# Tasks — Tipos de tarefa reais no modal de Nova OS

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | `ordem-servico-gateway.ts`: `TipoTarefaOpcao`, `DadosAberturaOs.tiposTarefa`, `CriarOrdemServicoInput.tipoTarefaId` (substitui `tipoAuvo`) | AC-1 | — | typecheck | done |
| 2  | `supabase-ordem-servico-adapter.ts`: `carregarDadosAbertura` busca `tipos_tarefa` (`ativo=true`,`deleted_at is null`) no mesmo `Promise.all` | AC-1, AC-3 | 1 | `pnpm test` | done |
| 3  | `domain/abertura-os.ts`: remove `TIPOS_AUVO`/`sugerirTipoAuvo`/`TIPO_POR_CATEGORIA` | — | 1 | typecheck | done |
| 4  | `application/abrir-ordem-servico.ts`: valida `tipoTarefaId` obrigatório | AC-2 | 1 | `pnpm test` | done |
| 5  | `NovaOrdemServicoModal.tsx`: select lê `dados.tiposTarefa`, `required`, estado vazio com link p/ `TiposTarefaPage` | AC-1, AC-2, AC-4 | 1-4 | manual | done |
| 6  | Atualizar `abertura-os.test.ts`/`abrir-ordem-servico.test.ts` (removem teste de `sugerirTipoAuvo`, cobrem validação de `tipoTarefaId`) | AC-2 | 1-4 | `pnpm test` | done |
| 7  | `pnpm run ci:local` + ROADMAP/STATE | todos | 1-6 | `pnpm run ci:local` | pending (rodar no fim do lote) |

## Plano de teste
- Unidade: `abrir-ordem-servico.test.ts` cobre `tipoTarefaId` vazio rejeitado (AC-2).
- Manual (dev local): abrir modal, conferir que a lista bate com `TiposTarefaPage`; tentar submeter sem
  selecionar tipo.

## Divergências (SPEC_DEVIATION)
- [x] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes
- [ ] `pnpm run ci:local` verde
- [ ] ROADMAP/STATE atualizados
