---
name: tasks
description: Decomposição e gates — promoção de pcm.tecnicos_cache para pcm.funcionarios (editável).
alwaysApply: false
---

# Tasks — Funcionários

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S28_promove_funcionarios.sql`: renomear/estender `pcm.tecnicos_cache` → `pcm.funcionarios` (ou criar `pcm.funcionarios` nova + migrar dados + deprecar a cache, decidir na implementação qual é mais seguro para não quebrar `E01-S11`/dashboards que já leem `tecnicos_cache`), adicionar colunas (`cargo`, `telefone`, `email`, `tipo`, `auvo_sync_status/error/synced_at` se ainda não existirem), **substituir as policies `tecnicos_cache_deny_*` de `0012` por policies de escrita por módulo `pcm`** (documentar explicitamente a inversão de contrato no comentário da migration), trigger `fn_auvo_enqueue('funcionarios')` | AC-1, AC-2, AC-3, AC-6 | E01-S22 mergeada | `supabase test db` | todo |
| 2  | Descriptor `registry/funcionarios.ts` (`auvoBasePath:'/users'`, `webhookEntity:1`, `deactivatePatch:{unavailableForTasks:true}`, `writeEnabled:false`, `toAuvoCreate` inclui `name`/`culture`/`userType`/`login`/`password`, `toAuvoPatch` só mapeia campos não-credencial — nunca inclui `password`/`login` em edição) | AC-1, AC-2, AC-3, AC-4 | 1 | teste Deno do descriptor | todo |
| 3  | Estender (ou criar, se não houver ainda) `application/funcionarios-gateway.ts` + `infrastructure/supabase-funcionarios-adapter.ts` com `listar`/`criar`/`editar`/`desativar`; senha só trafega no comando de criação e não é persistida em `pcm.funcionarios` | AC-1, AC-2, AC-3, AC-5 | 1 | `vitest` | todo |
| 4  | `pages/FuncionariosPage.tsx` (lista + criar + editar + desativar, gate `podeAcessar('pcm','escrita')`; formulário de criação exige `login`/`password`/`userType` e avisa que cria acesso real ao app de campo) | AC-1, AC-5 | 3 | teste manual em browser | todo |
| 5  | Wiring em `HomePage.tsx`: item "Funcionários" em CADASTROS | AC-5 | 4 | `pnpm run build` | todo |
| 6  | Teste de segurança do fluxo de criação: `password` não é armazenada no banco, não aparece em payload de PATCH, não é logada em erro do adapter/descriptor | AC-1 | 2, 3 | `vitest` + teste Deno | todo |
| 7  | pgTAP `supabase/tests/funcionarios_rls.test.sql`: confirma que a RLS agora PERMITE escrita por módulo (teste espelhado ao de `tecnicos_equipamentos_cache_rls.test.sql`, mas com resultado invertido — documentar no teste que essa inversão é intencional) | AC-6 | 1 | `supabase test db` | todo |
| 8  | Rodar `pnpm run ci:local` | todos | 1–7 | `pnpm run ci:local` | todo |
| 9  | Atualizar ROADMAP/STATE | — | 8 | revisão humana | todo |

## Plano de teste
- Unidade: adapter (mapeamento), descriptor (`toAuvoCreate` inclui credencial; `toAuvoPatch`
  nunca inclui credencial).
- pgTAP: RLS agora permite escrita por módulo (inversão documentada e testada, não assumida).
- Aceite: os 6 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] Decisão do PO em 2026-07-07: PCM pode criar funcionário novo, mesmo provisionando
      credencial real no Auvo. Spec/tasks atualizados para incluir `criar-funcionario`.

## Checklist de Definition of Done
- [ ] AC-1 a AC-6 verdes pelo gate executável
- [ ] Fluxo de criação não persiste nem loga senha
- [ ] Migration de promoção revisada com atenção redobrada (inversão de RLS, não é um bug)
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
