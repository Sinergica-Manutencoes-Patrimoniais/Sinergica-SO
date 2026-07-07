---
name: tasks
description: Decomposição e gates — promoção de pcm.tecnicos_cache para pcm.funcionarios (editável).
alwaysApply: false
---

# Tasks — Funcionários

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `00NN_E01-S28_promove_funcionarios.sql`: renomear/estender `pcm.tecnicos_cache` → `pcm.funcionarios` (decidido: criar tabela nova `pcm.funcionarios`, migrar dados e deprecar o cache para não quebrar testes/contrato read-only de `tecnicos_cache`), adicionar colunas (`cargo`, `telefone`, `email`, `tipo`, `auvo_sync_status/error/synced_at` se ainda não existirem), policies de escrita por módulo `pcm`, comentário explicitando a inversão de contrato, trigger `fn_auvo_enqueue('funcionarios')` | AC-1, AC-2, AC-3, AC-6 | E01-S22 mergeada | `pnpm run lint:migrations`; pgTAP escrito, execução pendente (sem Docker) | done |
| 2  | Descriptor `registry/funcionarios.ts` (`auvoBasePath:'/users'`, `webhookEntity:1`, `deactivatePatch:{unavailableForTasks:true}`, `writeEnabled:false`, `toAuvoPatch` só mapeia campos não-credencial — nunca inclui `password`/`login` em edição). Criação com senha ficou em Edge Function dedicada para não persistir segredo no outbox | AC-1, AC-2, AC-3, AC-4 | 1 | teste Deno escrito; execução pendente (sem Deno CLI) | done |
| 3  | Criar `application/funcionarios-gateway.ts` + `infrastructure/supabase-funcionarios-adapter.ts` com `listar`/`criar`/`editar`/`desativar`; senha só trafega no comando de criação e não é persistida em `pcm.funcionarios` | AC-1, AC-2, AC-3, AC-5 | 1 | `pnpm run test`; `pnpm run typecheck` | done |
| 4  | `pages/FuncionariosPage.tsx` (lista + criar + editar + desativar, gate `podeAcessar('pcm','escrita')`; formulário de criação exige `login`/`password`/`userType` e avisa que cria acesso real ao app de campo) | AC-1, AC-5 | 3 | `pnpm run build`; manual pendente | done |
| 5  | Wiring em `HomePage.tsx`: item "Funcionários" em CADASTROS | AC-5 | 4 | `pnpm run build` | done |
| 6  | Teste de segurança do fluxo de criação: `password` não é armazenada no banco, não aparece em payload de PATCH, não é logada em erro do adapter/descriptor | AC-1 | 2, 3 | `vitest` + teste Deno escrito | done |
| 7  | pgTAP `supabase/tests/funcionarios_rls.test.sql`: confirma que a RLS agora PERMITE escrita por módulo (teste espelhado ao de `tecnicos_equipamentos_cache_rls.test.sql`, mas com resultado invertido — documentar no teste que essa inversão é intencional) | AC-6 | 1 | escrito; `supabase test db` pendente (sem Docker) | done |
| 8  | Rodar `pnpm run ci:local` | todos | 1–7 | `pnpm run ci:local` verde | done |
| 9  | Atualizar ROADMAP/STATE | — | 8 | revisão humana | done |

## Plano de teste
- Unidade: adapter (mapeamento), descriptor (`toAuvoCreate` inclui credencial; `toAuvoPatch`
  nunca inclui credencial).
- pgTAP: RLS agora permite escrita por módulo (inversão documentada e testada, não assumida).
- Aceite: os 6 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] Decisão do PO em 2026-07-07: PCM pode criar funcionário novo, mesmo provisionando
      credencial real no Auvo. Spec/tasks atualizados para incluir `criar-funcionario`.
- [x] Criação de funcionário não usa o outbox genérico, porque `/users` exige `password` e o
      outbox buscaria a linha depois, forçando persistência de senha. Implementado como Edge
      Function autenticada (`pcm-auvo-users-create`) que recebe senha em memória, chama `/users` e
      insere `pcm.funcionarios` via RPC com anti-loop.

## Revisão adversarial (2026-07-07)
- **CORRIGIDO** — `pcm-auvo-users-sync` (Edge Function legada de `E01-S11`, ainda ativa via
  `pg_cron` diário) fazia upsert em massa e reconciliação de soft-delete direto em
  `pcm.funcionarios` via PostgREST comum, sem setar `app.auvo_sync_write`. Como esta story anexou
  `trg_funcionarios_auvo_enqueue`, cada sync diário passou a enfileirar N linhas na outbox por
  rodada (inofensivo com `writeEnabled:false`, mas eco real assim que ligado). Corrigido: upsert
  agora usa `fn_upsert_auvo_sync` por linha; desativação usa `fn_apply_auvo_sync` por linha (mesma
  semântica `ativo=false`, não `deleted_at`, preservada).

## Checklist de Definition of Done
- [x] AC-1 a AC-6 implementados; gates locais Node verdes
- [x] Fluxo de criação não persiste nem loga senha
- [x] Migration de promoção revisada com atenção redobrada (inversão de RLS, não é um bug)
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] `pnpm run ci:local` verde
- [ ] Testes Deno e pgTAP executados em ambiente com Deno CLI/Docker
