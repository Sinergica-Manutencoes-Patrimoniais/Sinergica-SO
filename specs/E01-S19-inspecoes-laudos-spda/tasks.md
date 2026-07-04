---
name: tasks-E01-S19-inspecoes-laudos-spda
description: Tasks de implementação das abas de Inspeções e Laudos SPDA no PCM SO.
alwaysApply: false
story: E01-S19
owner: "@sm"
status: done
created_at: 2026-07-04
---

# Tasks — E01-S19

- [x] T1 — Criar migration com tabelas, índices, grants e RLS.
  - AC: 1, 2, 3, 4, 5, 6, 8
  - Gate: `pnpm run lint:migrations`
- [x] T2 — Criar domínio e testes para inspeções/laudos.
  - AC: 3, 6
  - Gate: `pnpm test -- apps/web/src/features/pcm/domain/inspecoes-laudos.test.ts`
- [x] T3 — Criar gateway/adapters Supabase para listar/criar registros e itens.
  - AC: 1, 2, 3, 4, 5, 6, 7
  - Gate: `pnpm test`
- [x] T4 — Criar abas `Inspeções` e `Laudo SPDA` no PCM.
  - AC: 1, 2, 3, 4, 5, 6, 7
  - Gate: `pnpm run typecheck && pnpm run build`
- [x] T5 — Atualizar ROADMAP/STATE e executar revisão adversarial QA.
  - AC: todos
  - Gate: `pnpm run audit:esteira`

## Resultado

- Criada migration `0019_E01-S19_inspecoes_laudos_spda.sql` com tabelas de inspeções, itens,
  laudos SPDA e pontos de medição, RLS por `user_modulos.pcm`, grants e trigger de totais.
- Criadas as abas `Inspeções` e `Laudo SPDA` no PCM, com gate de leitura/escrita.
- Fotos/anexos permanecem como `foto_url`/link Auvo; nenhum bucket Storage foi criado nesta story.

## Gates

- `pnpm run lint:migrations` ✅
- `pnpm --filter @sinergica/web test -- src/features/pcm/domain/inspecoes-laudos.test.ts src/features/pcm/application/qualidade.test.ts` ✅
- `pnpm run lint` ✅
- `pnpm run typecheck` ✅
- `pnpm run test` ✅ — 108 pass / 9 skip
- `pnpm run build` ✅ — warning conhecido de chunk >500 kB
- `pnpm run audit:esteira` ✅
- `pnpm run eval:spec` ✅ — E01-* ainda fora da matriz do script; sem regressão

## Revisão adversarial @qa

- AC-7: ações de criação ficam escondidas quando `podeAcessar('pcm','escrita')` é falso; RLS
  também bloqueia INSERT/UPDATE sem escrita.
- Anexos/fotos: não há Storage nesta entrega; campo `foto_url` aceita link Auvo/referência externa.
- Data padrão: ajustada para data local do navegador, não UTC.
- Cliente inativo: listas históricas continuam resolvendo nome de cliente não deletado mesmo se
  inativo; criação só oferece clientes ativos.
- Gap residual: criação de número do laudo usa contagem (`SPDA-0001` etc.); se houver criação
  concorrente real, deve virar sequence/RPC em hardening futuro.
