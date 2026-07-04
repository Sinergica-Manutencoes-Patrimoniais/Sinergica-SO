---
name: tasks-E01-S20-os-backlog-operacional
description: Tasks das telas reais de Ordens de Serviço e Backlog GUT no PCM.
alwaysApply: false
story: E01-S20
owner: "@sm"
status: done
created_at: 2026-07-04
---

# Tasks — E01-S20

- [x] T0 — Criar migration de banco para histórico de status de OS.
  - AC: 7
  - Gate: `pnpm run lint:migrations`
- [x] T1 — Criar domínio puro de OS/backlog operacional.
  - AC: 2
  - Gate: `pnpm --filter @sinergica/web test -- src/features/pcm/domain/ordens-servico.test.ts`
- [x] T2 — Criar gateway/application/adapter Supabase para listar OS e alterar status.
  - AC: 1, 3, 4, 6
  - Gate: `pnpm run test`
- [x] T3 — Criar páginas `Ordens de Serviço` e `Backlog GUT`.
  - AC: 1, 2, 3, 4, 5, 6
  - Gate: `pnpm run typecheck && pnpm run build`
- [x] T4 — Conectar navegação PCM e atualizar ROADMAP/STATE.
  - AC: todos
  - Gate: `pnpm run audit:esteira`

## Resultado

- `Ordens de Serviço` agora abre uma tela real sobre `pcm.ordens_servico`, com KPIs, filtros,
  detalhe e alteração de status para usuários com escrita PCM.
- `Backlog GUT` agora lista OS abertas ordenadas por `score_pcm desc`, com ação `Planejar`.
- Criada migration `0020_E01-S20_os_backlog_operacional.sql` com `pcm.os_status_eventos` e trigger
  append-only em `pcm.ordens_servico`.
- A story reaproveita a tabela `pcm.ordens_servico` existente e o trigger Auvo de
  `status='planejamento'`.

## Gates

- `pnpm run lint:migrations` ✅
- `pnpm --filter @sinergica/web test -- src/features/pcm/domain/ordens-servico.test.ts src/features/pcm/application/hub-os.test.ts` ✅
- `pnpm run lint` ✅
- `pnpm run typecheck` ✅
- `pnpm run test` ✅ — 113 pass / 9 skip
- `pnpm run build` ✅ — warning conhecido de chunk >500 kB
- `pnpm run audit:esteira` ✅

## Revisão adversarial @qa

- AC-5: comandos de alteração/planejamento são renderizados só com `podeAcessar('pcm','escrita')`;
  RLS de `pcm.ordens_servico` mantém o bloqueio no banco.
- AC-6: tela mostra somente campos Auvo já persistidos na OS (`auvo_task_id`, `auvo_sync_status`,
  `auvo_sync_error`), sem buscar/inventar dados adicionais.
- AC-7: trigger `trg_os_status_eventos` registra criação e mudança de status; tabela é
  append-only para usuários autenticados (SELECT apenas; escrita por trigger/service_role).
- Planejar uma OS muda status para `planejamento`; isto pode disparar o trigger Auvo existente
  (`0011`) se o ambiente estiver com secrets/pg_net configurados.
- Gap residual: regras finas de transição de status e kanban completo permanecem para E01-S07.
