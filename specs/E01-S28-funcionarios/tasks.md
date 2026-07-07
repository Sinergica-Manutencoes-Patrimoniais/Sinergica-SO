---
name: tasks
description: Decomposição e gates — promoção de pcm.tecnicos_cache para pcm.funcionarios (editável).
alwaysApply: false
---

# Tasks — Funcionários

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 0  | **Confirmar com Lucas/Fabrício a decisão de produto pendente** (spec.md → Riscos): PCM pode criar funcionário novo (com credencial) ou só edita os já importados? Bloqueia só a task 6 (criar); o resto da story (editar/listar/sync) não depende da resposta | — | — | resposta do PO registrada em `spec.md`/`docs/STATE.md` | todo |
| 1  | Migration `00NN_E01-S28_promove_funcionarios.sql`: renomear/estender `pcm.tecnicos_cache` → `pcm.funcionarios` (ou criar `pcm.funcionarios` nova + migrar dados + deprecar a cache, decidir na implementação qual é mais seguro para não quebrar `E01-S11`/dashboards que já leem `tecnicos_cache`), adicionar colunas (`cargo`, `telefone`, `email`, `tipo`, `auvo_sync_status/error/synced_at` se ainda não existirem), **substituir as policies `tecnicos_cache_deny_*` de `0012` por policies de escrita por módulo `pcm`** (documentar explicitamente a inversão de contrato no comentário da migration), trigger `fn_auvo_enqueue('funcionarios')` | AC-1, AC-2, AC-5 | E01-S22 mergeada | `supabase test db` | todo |
| 2  | Descriptor `registry/funcionarios.ts` (`auvoBasePath:'/users'`, `webhookEntity:1`, `deactivatePatch:{unavailableForTasks:true}`, `writeEnabled:false`, `toAuvo` só mapeia campos não-credencial — nunca inclui `password`/`login` no patch de edição) | AC-1, AC-2, AC-3 | 1 | teste Deno do descriptor | todo |
| 3  | Estender (ou criar, se não houver ainda) `application/funcionarios-gateway.ts` + `infrastructure/supabase-funcionarios-adapter.ts` com `listar`/`editar`/`desativar` (SEM `criar` até a task 0 responder) | AC-1, AC-2, AC-4 | 1 | `vitest` | todo |
| 4  | `pages/FuncionariosPage.tsx` (lista + editar + desativar, gate `podeAcessar('pcm','escrita')`) | AC-4 | 3 | teste manual em browser | todo |
| 5  | Wiring em `HomePage.tsx`: item "Funcionários" em CADASTROS | AC-4 | 4 | `pnpm run build` | todo |
| 6  | **[Bloqueada pela task 0]** Se o PO confirmar que criar é permitido: `criar-funcionario` use case + formulário com `login`/`password`/`userType`, com aviso de segurança explícito na UI ("isso cria acesso real ao app de campo") | AC-1 | 0 | `vitest` + manual | todo |
| 7  | pgTAP `supabase/tests/funcionarios_rls.test.sql`: confirma que a RLS agora PERMITE escrita por módulo (teste espelhado ao de `tecnicos_equipamentos_cache_rls.test.sql`, mas com resultado invertido — documentar no teste que essa inversão é intencional) | AC-5 | 1 | `supabase test db` | todo |
| 8  | Rodar `pnpm run ci:local` | todos | 1–7 (+6 se aplicável) | `pnpm run ci:local` | todo |
| 9  | Atualizar ROADMAP/STATE | — | 8 | revisão humana | todo |

## Plano de teste
- Unidade: adapter (mapeamento), descriptor (`toAuvo` nunca inclui credencial).
- pgTAP: RLS agora permite escrita por módulo (inversão documentada e testada, não assumida).
- Aceite: os 5 AC de `spec.md` (AC-1 depende da resposta da task 0 para o caminho de criação;
  edição/leitura/sync não dependem).

## Divergências (SPEC_DEVIATION)
- [ ] Task 0 é uma OPEN-QUESTION ao PO, não uma divergência de spec — registrar a resposta aqui
      quando vier, e ajustar `spec.md` (Fora de escopo → Riscos) de acordo.

## Checklist de Definition of Done
- [ ] AC-1 a AC-5 verdes pelo gate executável (AC-1/criação condicional à task 0)
- [ ] Decisão da task 0 registrada em `docs/STATE.md` antes de fechar a story
- [ ] Migration de promoção revisada com atenção redobrada (inversão de RLS, não é um bug)
- [ ] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [ ] `pnpm run ci:local` verde
