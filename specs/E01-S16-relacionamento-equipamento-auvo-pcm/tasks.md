---
name: tasks-E01-S16-relacionamento-equipamento-auvo-pcm
description: Decomposição e gates do relacionamento equipamento Auvo ↔ PCM.
alwaysApply: false
---

# Tasks — E01-S16 Relacionamento Equipamento Auvo ↔ PCM

## Plano
| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Migration `0017_E01-S16_os_equipamentos_auvo.sql`: criar tabela de relacionamento `pcm.os_equipamentos_auvo` com FK para OS, `auvo_equipment_id`, `source`, `payload_ref`; RLS read-only para módulo PCM; `service_role` escreve | AC-1, AC-2 | `pnpm run lint:migrations` | done |
| 2 | Extrair defensivamente `equipmentId`/equivalentes do payload do webhook | AC-2, AC-3 | revisão de código + Deno/CI quando disponível | done (código; Deno não executado) |
| 3 | Upsert OS↔equipamento no `pcm-auvo-webhook` quando houver equipamento no payload | AC-2, AC-3 | revisão de código + Deno/CI quando disponível | done (código; Deno não executado) |
| 4 | Corrigir Visão 360 para consultar `equipamentos_cache.auvo_customer_id` | AC-4 | `pnpm run typecheck` + `pnpm test` | done |
| 5 | Atualizar docs de status e ROADMAP | — | inspeção | done |

## Resultado
- `pcm.os_equipamentos_auvo` criada como tabela de relacionamento, sem duplicar atributos do Auvo.
- `pcm-auvo-webhook` faz upsert do vínculo quando encontra `equipmentId`/equivalente no payload.
- Visão 360 corrigida para consultar `equipamentos_cache.auvo_customer_id`, a coluna real de E01-S11.

## Gates rodados
- `pnpm run lint:migrations` ✅
- `pnpm run lint` ✅
- `pnpm run typecheck` ✅
- `pnpm test` ✅ (93 passed, 9 skipped)
- `pnpm run build` ✅
- `pnpm run audit:esteira` ✅
- `pnpm run eval:spec` ✅, mas sem cobertura automática para pastas `E01-*`.

## Não verificado neste ambiente
- Edge Function Deno não foi executada localmente.
- Shape real do campo de equipamento no payload Auvo precisa ser confirmado.

## Revisão adversarial esperada
- Confirmar que `pcm.equipamentos_cache` não foi enriquecida com atributos duplicados.
- Confirmar que payload sem equipamento não falha.
- Confirmar que a query da Visão 360 não usa mais coluna inexistente.
