# Tasks — E01-S165: Plano multialvo, versões de Rotina e questionários referenciados

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** implementação concluída; suíte web completa, pgTAP integrado (183 assertions) e E2E visual isolado (run 42279514625) passaram. T016 permanece aberto para CI completa com db-tests, revisão formal e homologação.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S165-plano-versoes-rotinas/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).

## Phase 2 — Foundation

- [X] T002 Escrever testes pgTAP para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência nos artefatos `supabase/tests/E01-S165_*.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7). Execução fica em T016.
- [X] T003 Criar as migrations aditivas E01-S165 em `supabase/migrations/`, aplicando constraints, transições, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs e compatibilidade (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7). Aplicação/validação ficam em T016.

## Phase 3 — US1: Elaborar Plano amplo sem efeito operacional

**Independent Test:** Criar Plano Guainumbí com Extintores, QGBT, VRF e Grupo Quantitativo; reabrir rascunho com três Rotinas distintas e nenhum registro de execução criado.

- [X] T004 [US1] Escrever testes unitários para escopo multialvo do Plano, alvo exclusivo por versão de Rotina, rascunho, instrução/checklist e tempo pendente em `apps/web/src/features/pcm/domain/plano-manutencao-us1.test.ts` (AC-1, AC-2, AC-3). Execução fica em T016.
- [X] T005 [US1] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/plano-manutencao-us1.test.ts` (AC-1, AC-2, AC-3). Execução fica em T016.
- [X] T006 [US1] Implementar regras de domínio de US1 em `apps/web/src/features/pcm/domain/plano-manutencao.ts` conforme `data-model.md` e `spec.md` (AC-1, AC-2, AC-3).
- [X] T007 [US1] Implementar casos de uso/RPCs de US1 com autorização, revisão, idempotência e auditoria transacional em `apps/web/src/features/pcm/application/plano-manutencao.ts` e `apps/web/src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.ts` (AC-1, AC-2, AC-3).
- [X] T008 [US1] Implementar consultas/invalidação e jornada US1 em `apps/web/src/features/pcm/application/plano-manutencao-queries.ts` e `apps/web/src/features/pcm/interfaces/plano-manutencao/Workspace.tsx` (AC-1, AC-2, AC-3).

## Phase 4 — US2: Aprovar e revisar com histórico preservado

**Independent Test:** Aprovar, copiar modelo, alterar data-base e retirar escopo com efeito futuro; comparar versão e questionário usados por execução antiga.

- [X] T009 [US2] Escrever testes unitários para aprovação, versionamento, snapshot de Rotinas/questionário, histórico e prévia de revisão/retirada/suspensão em `apps/web/src/features/pcm/domain/plano-manutencao-us2.test.ts` (AC-4, AC-5, AC-6, AC-7). Execução fica em T016.
- [X] T010 [US2] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/plano-manutencao-us2.test.ts` (AC-4, AC-5, AC-6, AC-7). Execução fica em T016.
- [X] T011 [US2] Implementar aprovação por capacidade, versionamento, snapshots, histórico e prévia em `apps/web/src/features/pcm/domain/plano-manutencao.ts` (AC-4, AC-5, AC-6, AC-7).
- [X] T012 [US2] Implementar casos de uso/RPCs de US2 com autorização, revisão, idempotência e auditoria transacional nos módulos application/infrastructure de plano de manutenção (AC-4, AC-5, AC-6, AC-7).
- [X] T013 [US2] Implementar consultas/invalidação e jornada US2 em `apps/web/src/features/pcm/application/plano-manutencao-queries.ts` e `apps/web/src/features/pcm/interfaces/plano-manutencao/Workspace.tsx` (AC-4, AC-5, AC-6, AC-7).

## Phase 5 — Integration and Gates

- [X] T014 Escrever testes de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.test.ts`, incluindo rollback e concorrência; executar em T016 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).
- [X] T015 Escrever a jornada E2E crítica e acesso negado entre dois Clientes em `apps/web/e2e/plano-manutencao.spec.ts`, incluindo consumidores globais/Cliente360; a jornada visual isolada passou no run 42279514625 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).
- [ ] T016 Executar quickstart, testes focados (incluindo classificação manter/alterar/retirar), eval:spec com seleção conferida, ci:local e revisão adversarial; registrar resultados/ressalvas e futura CI com db-tests habilitado antes do PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7). Ver [registro integrado do lote](../../docs/planejamento/plano-manutencao/validacao-lote-s165-s166-s170-s176.md): pgTAP candidata (250 assertions) e E2E visual isolado (run 42279514625) passaram no clone descartável; a CI local integrada ainda falhou em gates globais e testes. T016 fica aberto para CI GitHub/db-tests, demais gates de integração, revisão formal e homologação.

### Evidência escrita ainda não executada

- `supabase/tests/E01-S165_transicao_plano.test.sql` cobre gate fechado, suspensão/retomada, recibos idempotentes, histórico append-only, preservação de ocorrência vencida e bloqueio de nova ocorrência preparada enquanto suspenso. Recibo explicita que geradores legados ainda exigem reconciliação.
- `supabase/tests/E01-S165_revisao_os.test.sql` cobre diagnóstico/listagem de OS aberta ligada por ponte comprovada, cursor, revisão obsoleta e a limitação explícita de que a fotografia não calcula nem comprova ausência de impacto.
- `supabase/tests/E01-S165_gerador_legado_suspensao.test.sql` registra cobertura estrutural pgTAP para a reserva integrada no gerador legado e sua serialização com suspensão; não foi executado.
- `supabase/migrations/1823_E01-S165_recibo_reconciliacao_revisionada.sql` e [ADR-1681](../../docs/adr/1681-recibo-completo-reconciliacao-revisao-plano.md) acrescentam recibo mediado e paginado, comparando snapshots por Rotina lógica, alvo, ciclo/data original e estado integral do questionário. Lista manter/alterar/retirar/indeterminada e OS abertas somente por ponte comprovada (legada, explícita, Grupo ou Chamado); ausência de vínculo não vira ausência de OS. Falhas, gates fechados, legado não classificado e páginas restantes bloqueiam confirmação com motivos.
- O modo `--ui-s165-e2e` do runner de clone descartável lê `recorte-s165-1822-overlay.json` antes de criar containers, valida o hash/contagem do manifesto base, IDs e ordem 1822/1823, dependências, SHA-256, Git blobs e todos os pins. Depois adiciona as duas migrations ao lote, após as dependências candidatas; o workflow UI S165 usa esse modo. Isso conecta o ensaio isolado, sem aplicar migrations fora do clone descartável.
- `ReciboReconciliacaoRevisao.tsx` conecta o recibo ao preflight e `AcoesRevisaoPlano.tsx` desabilita confirmação se faltar recibo, houver erro, fonte incompleta ou paginação pendente. Testes de componente e fluxo escritos, ainda não executados.
- [ADR-1680](../../docs/adr/1680-guard-gerador-legado-integrado-plano.md) altera o guard por ciclo de `pcm.materializar_ocorrencias_preventivas`: reservas `integrar_ponte` só geram enquanto o Plano SSO vinculado estiver aprovado/ativo; `somente_sso` e `somente_legado` preservam semânticas distintas. Planos legados sem ponte/reserva continuam não atribuíveis e com impacto desconhecido.
- Cobertura pgTAP escrita para manutenção, alteração de data-base, retirada, OS comprovada e bloqueio de fonte sem ponte; alterações/retiradas e integração continuam sem execução e precisam ser validadas em T016.
- O pgTAP existente cobre snapshot/questionário histórico, revisão e retirada; `supabase/manual-tests/s165_concorrencia_1807_isolada.py` cobre cenários de concorrência preparados. Nenhum desses artefatos foi executado nesta etapa.
- A revisão com OS aberto permanece diagnóstico informativo parcial, sem prova de reconciliação completa; execução de T014/T016 e homologação continuam pendentes.

## Dependencies & Execution Order

E01-S170, E01-S176 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Biblioteca/editoração/publicação de questionários própria e import/export Auvo sem contrato comprovado; geração externa; Copiloto completo.
