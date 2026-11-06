# Tasks — E01-S170: Permissões por ação e governança configurável do programa

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** implementação e pgTAP (12 assertions) passaram no clone isolado integrado; T018 para refetch do formulário e preservação do Plano em edição foi implementado. T019 estabiliza a seleção do alvo após a consulta carregar; aguarda validação integrada. T016 permanece aberto para E2E, CI completa com db-tests, revisão formal e homologação; código escrito não equivale a PASS.

### Estado da evidência no candidato

- Código encontrado: domain/application/adapters, testes unitários, Workspace, E2E e runner isolado; pgTAP basal para capacidades e pgTAP adicional para migrations 1790/1795.
- E2E isolado S170 escrito para: administrador conceder/revogar `plano.gerir` durante a sessão aberta do operador (AC-1/AC-2), operador criar Plano/Rotina e autoaprovar o próprio Plano após a concessão (AC-4), e supervisor validar retorno sintético (AC-5). A fixture parte sem `plano.gerir`; UI e runner ainda aguardam execução no lote final.
- Não executado nesta revisão: testes, workflow, serviços, concorrência real, CI ou homologação.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S170-governanca-plano/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [X] T002 Escrever testes pgTAP para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão em `supabase/tests/E01-S170_capacidades_sso.test.sql` e cobertura adicional das migrations 1790/1795 em `supabase/tests/E01-S170_autorizacao_modulos_1790_1795.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6). Os artefatos estão escritos; execução integrada/concorrência permanece em T016.
- [X] T003 Criar migrations E01-S170 0239–0243 e 1790/1795 com constraints, RLS FORCE, auditoria append-only e requestId/revisão transacional, preservando compatibilidade (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6). Migrations escritas; aplicação/validação permanecem em T016.

## Phase 3 — US1: Configurar e aplicar capacidades atuais

**Independent Test:** Administrador atribui perfis acumuláveis e concessão individual; Operador tenta ação direta sem capacidade e acesso Cliente cruzado.

- [X] T004 [US1] Escrever testes de composição de perfis/capacidades, escopo e autorização atual em `apps/web/src/features/pcm/domain/capacidades-sso-us1.test.ts` (AC-1, AC-2, AC-3).
- [X] T005 [US1] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/capacidades-sso-us1.test.ts` conforme contrato de comandos (AC-1, AC-2, AC-3).
- [X] T006 [US1] Implementar composição de perfis/capacidades, escopo e autorização no domínio `apps/web/src/features/pcm/domain/capacidades-sso.ts` (AC-1, AC-2, AC-3).
- [X] T007 [US1] Implementar casos de uso/RPCs e adapter com autorização atual, revisão, idempotência e auditoria em `apps/web/src/features/pcm/application/capacidades-sso.ts` e `apps/web/src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.ts` (AC-1, AC-2, AC-3).
- [X] T008 [US1] Implementar consultas/invalidação e Workspace da jornada US1 com estados de carregamento/erro/retry, teclado e foco em `apps/web/src/features/pcm/application/capacidades-sso-queries.ts` e `apps/web/src/features/pcm/interfaces/capacidades-sso/Workspace.tsx` (AC-1, AC-2, AC-3).

## Phase 4 — US2: Gerir Plano e validar execução conforme decisão do Fabrício

**Independent Test:** Planejador sem/com concessão individual tenta autoaprovar; supervisor autorizado valida OS e consulta auditoria.

- [X] T009 [US2] Escrever testes para gestão individual de Plano, autoaprovação, validação específica e trilha de auditoria em `apps/web/src/features/pcm/domain/capacidades-sso-us2.test.ts` (AC-4, AC-5, AC-6).
- [X] T010 [US2] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/capacidades-sso-us2.test.ts` conforme contrato de comandos (AC-4, AC-5, AC-6).
- [X] T011 [US2] Implementar gestão individual de Plano, regras de validação e trilha de decisão no domínio `apps/web/src/features/pcm/domain/capacidades-sso.ts` (AC-4, AC-5, AC-6).
- [X] T012 [US2] Implementar casos de uso/RPCs e adapter com autorização atual, revisão, idempotência e auditoria em `apps/web/src/features/pcm/application/capacidades-sso.ts` e `apps/web/src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.ts` (AC-4, AC-5, AC-6).
- [X] T013 [US2] Implementar consultas/invalidação e Workspace da jornada US2 com estados de carregamento/erro/retry, teclado e foco em `apps/web/src/features/pcm/application/capacidades-sso-queries.ts` e `apps/web/src/features/pcm/interfaces/capacidades-sso/Workspace.tsx` (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [X] T014 Escrever teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.test.ts`. Executar integração, rollback e concorrência em duas sessões durante T016; mocks não comprovam esses pontos (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [X] T015 Escrever E2E isolado de validação do retorno, concessão/revogação durante sessão aberta e autoaprovação do Plano pelo seu criador após concessão individual; Cliente cruzado continua coberto por pgTAP em `apps/web/e2e/capacidades-sso.spec.ts` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6). Os cenários estão escritos e aguardam execução em T016.
- [ ] T016 Executar `specs/E01-S170-governanca-plano/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6). Ver [registro integrado do lote](../../docs/planejamento/plano-manutencao/validacao-lote-s165-s166-s170-s176.md): a seleção pgTAP candidata passou 250 assertions no clone descartável; a CI local integrada ainda falhou em gates globais e testes. E2E, CI GitHub e homologação permanecem pendentes.
- [X] T017 Corrigir consultas mediadas 1825–1827 para qualificar colunas `id`, cobrir listagens com regressão pgTAP e incluí-las no clone E2E descartável; tornar exato seletor acessível de alvo e atualizar pins. Execução fica em T016.
- [X] T018 Preservar seletor de Alvo com opções já carregadas durante refetch da mesma chave e manter visível somente o Plano ativo enquanto a consulta da lista atualiza; cobrir seletor e workspace sem executar testes até validação final integrada (AC-1, AC-4). Confirmação de permissão/revisão no salvamento permanece obrigatória.
- [X] T019 No E2E de governança, aguardar opção de Alvo não vazia antes de ler seu `value` e selecionar; remover a asserção `toBeEnabled` que divergia do estado nativo observado no ensaio anterior. A seleção e o runner permanecem sem execução nesta etapa e serão validados no lote integrado (AC-1, AC-4).

## Dependencies & Execution Order

Fatia iniciável isoladamente. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Identidades hardcoded; criar login técnico SSO; considerar escrita genérica como aprovação/validação automática.
