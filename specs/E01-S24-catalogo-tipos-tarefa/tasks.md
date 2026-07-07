---
name: tasks
description: Decomposição e gates — CRUD de Tipos de Tarefa (primeira entidade do motor de sync).
alwaysApply: false
---

# Tasks — Tipos de Tarefa

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0027_E01-S24_tipos_tarefa.sql`: tabela `pcm.tipos_tarefa` (`id uuid`, `nome text not null`, `preenche_relato boolean`, `exige_assinatura boolean`, `fotos_minimas int`, `ativo boolean default true`, `auvo_id bigint unique`, `auvo_sync_status/auvo_sync_error/auvo_synced_at`, colunas de auditoria, `deleted_at`), RLS FORCE + políticas módulo `pcm`, trigger `create trigger ... execute function pcm.fn_auvo_enqueue('tipos_tarefa')` | AC-1, AC-3, AC-6 | E01-S22 mergeada | `supabase test db` (pgTAP novo) | feito (migration; pgTAP não executado — sem Docker) |
| 2  | `supabase/functions/_shared/auvo/registry/tipos-tarefa.ts`: descriptor `{ key:'tipos_tarefa', auvoBasePath:'/tasktypes', pcmTable:'tipos_tarefa', cronSchedule:'0 6 * * *', writeEnabled:false, toAuvo, fromAuvo }` + registrar em `registry/index.ts`. `toAuvo` mapeia `nome→description`, `preenche_relato→requirements.fillReport`, `exige_assinatura→requirements.getSignature`, `fotos_minimas→requirements.minimumNumberOfPhotos`, `ativo→active`. `fromAuvo` o inverso + `standartTime` ignorado (sem campo PCM equivalente ainda) | AC-1, AC-2, AC-4 | 1 | teste Deno do descriptor (mapeamento nos dois sentidos, ida-e-volta não perde dado) | feito (código/teste; Deno não executado — sem Deno CLI) |
| 3  | Domínio `apps/web/src/features/pcm/domain/tipos-tarefa.ts` (tipo `TipoTarefa`, validação: `nome` obrigatório e não-vazio, `fotosMinimas >= 0`) | AC-1, AC-5 | — | `vitest` (domínio) | feito |
| 4  | `application/tipos-tarefa-gateway.ts` (port: `listar/criar/editar/excluir`) + use cases em `application/tipos-tarefa.ts` (valida no domínio antes de delegar ao gateway) | AC-1, AC-2, AC-3, AC-5 | 3 | `vitest` (use cases) | feito |
| 5  | `infrastructure/supabase-tipos-tarefa-adapter.ts` (CRUD via `schema('pcm').from('tipos_tarefa')`, mapeia snake↔camel, `.is('deleted_at', null)` nas listagens, exclusão = `update({deleted_at: now()})`) | AC-1, AC-2, AC-3 | 1, 4 | `vitest` (adapter, se integration test com Supabase local disponível; senão unit dos mappers) | feito (sem integration test local de Supabase) |
| 6  | `pages/TiposTarefaPage.tsx` (lista + criar/editar/excluir, gate `podeAcessar('pcm','escrita')` nos controles de escrita, estados carregando/erro/vazio — mesmo padrão de `OrdensServicoPage.tsx`) | AC-5 | 4, 5 | teste manual em browser (dev server) | feito (código/build; teste manual não executado para não criar dados sem DB/migration aplicada e limpeza) |
| 7  | Wiring em `apps/web/src/app/HomePage.tsx`: adicionar `'tipos-tarefa'` ao `PcmView`, item no grupo `CADASTROS` do `PCM_NAV`, branch no switch de render | AC-5 | 6 | `pnpm run build` | feito |
| 8  | pgTAP `supabase/tests/tipos_tarefa_rls.test.sql`: RLS FORCE, `authenticated` com `pcm:leitura` só lê, com `pcm:escrita` cria/edita/exclui (soft), sem módulo `pcm` nenhum acesso | AC-6 | 1 | `supabase test db` | pendente (sem Docker local) |
| 9  | Rodar `pnpm run ci:local` | todos | 1–8 | `pnpm run ci:local` | feito parcialmente — `lint:migrations`, `lint`, `typecheck`, `test` (132 pass/9 skip), `build`, `audit:esteira`, `eval:spec`, `arch:check` verdes; Deno/pgTAP/browser real pendentes |
| 10 | Atualizar `docs/epics/ROADMAP.md`/`docs/STATE.md` | — | 9 | revisão humana | feito |

## Plano de teste
- Unidade: domínio (validação), use cases (delegação + validação), descriptor (mapeamento ida-e-
  volta `toAuvo`/`fromAuvo`).
- pgTAP: RLS por módulo (AC-6).
- Aceite: os 6 AC de `spec.md`. AC-4 (poller) e AC-1/AC-2 (push) dependem de `E01-S22`/`E01-S23`
  já mergeadas — se ainda não estiverem, este story pode implementar a tela+migration+descriptor
  com `writeEnabled:false` e ficar aguardando a fundação antes de ativar o sync de verdade.
- Manual: criar/editar/excluir na tela, confirmar refresh da lista.

## Divergências (SPEC_DEVIATION)
- [ ] (preencher durante a implementação se necessário)

## Revisão adversarial (2026-07-07)
- **CORRIGIDO** — `pcm.tipos_tarefa.created_by` estava `not null` sem default (migration `0027`),
  mas `fn_upsert_auvo_sync` (usada pelo pull/webhook inbound) nunca preenche essa coluna — o
  primeiro registro genuinamente novo vindo do Auvo estouraria `NOT NULL violation`. As stories
  seguintes (`E01-S28` em diante) já tornaram `created_by` nullable; retrofitado aqui para
  consistência (coluna agora nullable, sem default).
- **Follow-up não corrigido** — a mitigação "match-by-description antes de criar" prometida no
  `design.md` de `E01-S22` para entidades sem `externalId` no POST (Task Types incluído) nunca foi
  implementada no descriptor nem em `pcm-auvo-push`. Dormente hoje (`writeEnabled:false`); ao
  ligar, qualquer retry de uma linha que já criou o tipo de tarefa no Auvo vai duplicá-lo.

## Checklist de Definition of Done
- [x] AC-1 a AC-6 implementados em código local
- [ ] Todos os AC (AC-1 a AC-6) verdes pelo gate executável completo (Deno/pgTAP/browser)
- [x] `writeEnabled` do descriptor só vira `true` depois de uma chamada real de verificação contra
      o Auvo (confirmar `description`/`requirements` shape) — documentar a verificação feita
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] `docs/STATE.md` e `docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde completo; localmente ficaram verdes os gates Node listados na task 9,
      mas Deno/pgTAP e teste manual com dado reversível ainda precisam rodar no ambiente adequado
