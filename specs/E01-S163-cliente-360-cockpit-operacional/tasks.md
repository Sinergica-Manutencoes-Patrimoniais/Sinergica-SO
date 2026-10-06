# Tasks: Cliente 360 como cockpit operacional

**Input**: Design documents from `specs/E01-S163-cliente-360-cockpit-operacional/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-contracts.md`

**Tests**: Obrigatórios; escrever primeiro, confirmar falha e só então implementar.

## Format

`[ID] [P?] [Story] Description (AC-N)` — `[P]` indica arquivos sem conflito e execução paralelizável.

## Phase 1: Foundation

**Purpose**: Estabelecer os contratos comuns de contexto, query e drawer antes das fatias de negócio.

- [ ] T001 [P] Criar testes e tipos da união `ContextoDetalhe360`, incluindo fechamento na troca de cliente e retorno seguro de foco, em `apps/web/src/features/pcm/domain/cliente-360-contexto.test.ts` e `cliente-360-contexto.ts` (AC-7, AC-15, AC-24).
- [ ] T002 [P] Criar query-key factory cliente-scoped e testes de invalidação em `apps/web/src/features/pcm/application/cliente-360-query-keys.test.ts` e `cliente-360-query-keys.ts`, reutilizando chaves globais quando representam o mesmo dado (AC-8, AC-21).
- [ ] T003 Implementar shell acessível de drawer, sem conteúdo de negócio, em `apps/web/src/features/pcm/components/Cliente360Drawer.tsx` e seu teste, cobrindo focus trap, Escape em pilha, retorno de foco, loading/error e reduced motion (AC-7, AC-15, AC-24).

**Checkpoint**: Contexto e shell são testáveis sem nenhuma user story concluída.

---

## Phase 2: User Story 1 — Resolver identificadores sem redigitação (P1)

**Goal**: Aplicar sugestões editáveis ao Identificador e persistir apenas ao salvar.

**Independent Test**: Aplicar recomendações num componente sem siglas, cancelar sem gravação; repetir, salvar e reabrir com valores persistidos.

- [ ] T004 [P] [US1] Escrever testes falhos de “Aplicar recomendações”, edição parcial, sugestão inválida e proteção de identificador existente em `apps/web/src/features/pcm/components/CampoIdentificador.test.tsx` (AC-1, AC-2, AC-4).
- [ ] T005 [P] [US1] Escrever testes falhos da operação lógica de persistência e rollback/erro sem ativo parcial em `apps/web/src/features/pcm/application/identificador-ativo.test.ts` (AC-3).
- [X] T006 [US1] Implementar estado de preview e ação explícita em `apps/web/src/features/pcm/components/CampoIdentificador.tsx`, sem escrita remota ao aplicar (AC-1, AC-2, AC-4).
- [X] T007 [US1] Ajustar `apps/web/src/features/pcm/application/identificador-ativo.ts` para validar/aplicar siglas e identificador pela operação lógica existente, preservando erro contextual e unicidade (AC-2, AC-3).
- [ ] T008 [US1] Integrar e testar o contrato em `apps/web/src/features/pcm/components/EquipamentoModal.tsx`, `EquipamentoModal.test.tsx`, `SistemaModal.tsx` e novo `SistemaModal.test.tsx`, incluindo cancelar e aviso de QR code (AC-1, AC-3, AC-4).

**Checkpoint**: US1 pode ser demonstrada isoladamente e não altera nenhum cockpit.

---

## Phase 3: User Story 2 — Operar OS e chamados sem sair do Cliente 360 (P1)

**Goal**: Reutilizar o detalhe global em drawer e remover apontamentos das projeções de manutenção.

**Independent Test**: Abrir OS com chamado no Cliente 360, agir, fechar e manter contexto; registros de visita não aparecem nem contam.

- [ ] T009 [P] [US2] Expandir testes de domínio em `apps/web/src/features/pcm/domain/ordens-servico.test.ts` para variações exatas normalizadas e títulos semelhantes que não devem ser excluídos (AC-9).
- [ ] T010 [P] [US2] Escrever regressão falha da composição de backlog, histórico, KPI e timeline do Cliente 360 em `apps/web/src/features/pcm/domain/cliente-360.test.ts` (AC-9).
- [ ] T011 [P] [US2] Escrever testes falhos do conteúdo compartilhado e composição de `ChamadoPainel` em novo `apps/web/src/features/pcm/components/OrdemServicoDetalhe.test.tsx` (AC-5, AC-6, AC-8).
- [ ] T012 [US2] Extrair o conteúdo selecionado de `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx` para novo `apps/web/src/features/pcm/components/OrdemServicoDetalhe.tsx`, mantendo a página global sobre o mesmo componente (AC-5, AC-6).
- [ ] T013 [US2] Compor `OrdemServicoDetalhe` no novo `apps/web/src/features/pcm/components/OrdemServicoDetalheDrawer.tsx` sobre `Cliente360Drawer`, com validação de `clienteId` e estados locais de falha (AC-5, AC-6, AC-7).
- [X] T014 [US2] Aplicar `ehOsRegistroVisita` nos read-models comuns de `apps/web/src/features/pcm/application/obter-visao-cliente.ts` e `apps/web/src/features/pcm/infrastructure/supabase-cliente-360-adapter.ts` antes de listas, KPIs e timeline, sem alterar agenda/apontamento (AC-9).
- [ ] T015 [US2] Integrar callbacks de seleção em Resumo, Timeline, backlog e histórico dentro de `apps/web/src/features/pcm/pages/VisaoClientePage.tsx` e atualizar seus testes para preservar aba, filtros, rolagem e foco (AC-5, AC-7).
- [ ] T016 [US2] Unificar handlers de autorização/mutação e invalidação entre `OrdensServicoPage.tsx`, `ChamadoPainel.tsx` e o drawer usando as query keys da fundação, com testes de sucesso e negação (AC-6, AC-8).

**Checkpoint**: US2 entrega o principal fluxo do cockpit sem depender de Preventivas ou filtros novos.

---

## Phase 4: User Story 3 — Planejar e investigar preventivas (P1)

**Goal**: Três visões consistentes, detalhes clicáveis e edição sem reescrever histórico.

**Independent Test**: Abrir a mesma ocorrência nas três visões e validar plano, histórico, OS, Auvo e bloqueio de recorrência após materialização.

- [ ] T017 [P] [US3] Escrever testes falhos da política `podeEditarEstruturaPlano` e imutabilidade de ocorrências em `apps/web/src/features/pcm/domain/preventivas.test.ts` (AC-13, AC-14).
- [ ] T018 [P] [US3] Escrever testes falhos de Lista/Timeline/Calendário equivalentes e preferência local válida em `apps/web/src/features/pcm/components/PreventivasWorkspace.test.tsx` (AC-10, AC-11, AC-15).
- [ ] T019 [P] [US3] Escrever testes falhos do drawer de ocorrência/plano, seções vazias e associação com OS/Auvo em novo `apps/web/src/features/pcm/components/PreventivaDetalheDrawer.test.tsx` (AC-11, AC-12, AC-15).
- [ ] T020 [P] [US3] Escrever teste de integração falho do comando de atualização e bloqueio estrutural no adapter em `apps/web/src/features/pcm/infrastructure/supabase-preventivas-adapter.test.ts` (AC-13, AC-14).
- [ ] T021 [US3] Implementar política pura de edição em `apps/web/src/features/pcm/domain/preventivas.ts` e ampliar contratos em `apps/web/src/features/pcm/application/preventivas-gateway.ts` sem efeitos sobre ocorrências (AC-13, AC-14).
- [ ] T022 [P] [US3] Criar `apps/web/src/features/pcm/components/PreventivasListaView.tsx` com ordenação operacional, estados e seleção por teclado (AC-10, AC-11, AC-15).
- [ ] T023 [P] [US3] Criar `apps/web/src/features/pcm/components/PreventivasTimelineView.tsx` com sequência prevista/enviada/executada/falha e seleção por teclado (AC-10, AC-11, AC-15).
- [ ] T024 [US3] Implementar `apps/web/src/features/pcm/components/PreventivaDetalheDrawer.tsx` para ocorrência/plano, próximas ocorrências, histórico, OS, Auvo e ações autorizadas (AC-11, AC-12, AC-15).
- [ ] T025 [US3] Implementar atualização validada em `apps/web/src/features/pcm/infrastructure/supabase-preventivas-adapter.ts`, rejeitando cliente divergente/campos estruturais bloqueados e preservando histórico (AC-13, AC-14).
- [ ] T026 [US3] Refatorar `apps/web/src/features/pcm/components/PreventivasWorkspace.tsx` para switcher único, Lista inicial, preferência local validada e drawer compartilhado; manter `PreventivasCalendarioView.tsx` como terceira visão (AC-10, AC-11, AC-12, AC-15).
- [ ] T027 [US3] Implementar ação “Pausar e criar novo plano” predefinindo formulário sem reutilizar id ou ocorrências e cobrir no teste do workspace (AC-13, AC-14).

**Checkpoint**: US3 é funcional isoladamente na aba Preventivas e não exige filtro/navegação novos.

---

## Phase 5: User Story 4 — Encontrar estruturas e ativos com filtros úteis (P2)

**Goal**: Filtros específicos, combináveis, rápidos e isolados por cliente nas quatro abas.

**Independent Test**: Combinar dois filtros em cada aba, validar contagem/empty state, limpar e trocar de cliente sem dado residual.

- [ ] T028 [P] [US4] Escrever testes falhos de normalização, AND/OR, sentinels e preservação de ancestrais em novo `apps/web/src/features/pcm/domain/cliente-360-filtros.test.ts` (AC-16, AC-17, AC-18, AC-19, AC-20).
- [ ] T029 [P] [US4] Escrever teste falho de categoria e período no read-model de ferramentas em `apps/web/src/features/pcm/infrastructure/supabase-ferramenta-alocacao-cliente-adapter.test.ts` (AC-19, AC-21).
- [ ] T030 [US4] Implementar tipos, defaults e predicados puros em novo `apps/web/src/features/pcm/domain/cliente-360-filtros.ts`, usando mapas/conjuntos pré-computados (AC-16, AC-17, AC-18, AC-19, AC-20, AC-21).
- [ ] T031 [P] [US4] Escrever testes de componente falhos para busca, filtros, contagem, clear e empty states em `PainelItensDoCliente.test.tsx`, novo `PainelSistemasCliente.test.tsx`, novo `PainelFerramentasCliente.test.tsx` e novo `EstruturaClientePage.test.tsx` (AC-16, AC-17, AC-18, AC-19, AC-20).
- [ ] T032 [P] [US4] Integrar filtros de Componentes em `apps/web/src/features/pcm/components/PainelItensDoCliente.tsx` usando relações já carregadas e estado resetado por cliente (AC-17, AC-20, AC-21).
- [ ] T033 [P] [US4] Integrar filtros de Sistemas em `apps/web/src/features/pcm/components/PainelSistemasCliente.tsx`, incluindo composição vazia/não vazia (AC-18, AC-20, AC-21).
- [ ] T034 [P] [US4] Integrar filtros e poda contextual em `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx`, mantendo ancestrais dos matches (AC-16, AC-20, AC-21).
- [ ] T035 [P] [US4] Ampliar `supabase-ferramenta-alocacao-cliente-adapter.ts` com categoria já existente e integrar filtros em `PainelFerramentasCliente.tsx`, sem inventar relação com técnico (AC-19, AC-20, AC-21).
- [ ] T036 [US4] Criar benchmark/teste de performance com 1.000 itens em novo `apps/web/src/features/pcm/domain/cliente-360-filtros.performance.test.ts`, registrar p95 e interromper para ADR separado se o orçamento falhar (AC-21).

**Checkpoint**: Cada aba filtrável pode ser entregue e demonstrada separadamente.

---

## Phase 6: User Story 5 — Usar o Cliente 360 como espaço diário (P2)

**Goal**: Navegação agrupada, overflow legível e ações rápidas autorizadas.

**Independent Test**: Em desktop e viewport estreito, alcançar todas as áreas e abrir/cancelar ações rápidas usando somente teclado.

- [ ] T037 [P] [US5] Escrever testes falhos da faixa contextual compacta do cliente, configuração Operação/Ativos/Gestão, overflow e aba ativa em `apps/web/src/features/pcm/pages/VisaoClientePage.test.ts` (AC-22).
- [ ] T038 [P] [US5] Escrever teste falho de visibilidade por permissão e predefinição do cliente nas quatro ações rápidas em novo `apps/web/src/features/pcm/components/Cliente360AcoesRapidas.test.tsx` (AC-23).
- [ ] T039 [US5] Criar faixa contextual horizontal do cliente e refatorar a configuração `ABAS` em `apps/web/src/features/pcm/pages/VisaoClientePage.tsx` para grupos e “Mais”, preservando ids, dados essenciais e conteúdo existentes (AC-22).
- [ ] T040 [US5] Criar `apps/web/src/features/pcm/components/Cliente360AcoesRapidas.tsx` que reutiliza os fluxos existentes de Chamado, OS, Preventiva e Componente com cliente predefinido e checagem de permissão (AC-23).
- [ ] T041 [US5] Cobrir navegação por teclado, anúncios, focus trap, Escape em pilha e reduced motion nos testes de `VisaoClientePage`, `Cliente360Drawer` e ações rápidas (AC-24).

**Checkpoint**: Todas as áreas atuais seguem alcançáveis, sem rótulos truncados.

---

## Phase 7: Polish and release gates

- [ ] T042 [P] Adicionar telemetria sem dados sensíveis nos pontos definidos em `research.md` e testes de payload em arquivos adjacentes (AC-1, AC-5, AC-10, AC-20).
- [ ] T043 Criar `apps/web/e2e/cliente-360-cockpit.spec.ts` com dois clientes e matriz de permissões, cobrindo identificador, drawer OS/Chamado, apontamentos excluídos, preventivas e filtros (AC-1, AC-3, AC-5, AC-7, AC-9, AC-10, AC-11, AC-13, AC-16, AC-17, AC-18, AC-19, AC-21, AC-23, AC-24).
- [ ] T044 Executar o roteiro de `quickstart.md`, corrigir regressões e registrar evidências objetivas de desempenho e isolamento no PR (AC-9, AC-21, AC-24).
- [ ] T045 Executar `pnpm run eval:spec` e `pnpm run ci:local`, incluindo `db-tests`, antes de solicitar PR; não fazer push/PR fora de `@devops`/humano (AC-1 a AC-24).
- [ ] T046 Executar `graphify update .` após as alterações quando a ferramenta estiver disponível e remover a linha E01-S163 do ROADMAP somente no fechamento conforme Definition of Done (AC-1 a AC-24).

## Dependencies & Execution Order

- Phase 1 bloqueia drawers/contexto compartilhado, mas US1 pode iniciar em paralelo por não depender deles.
- US2 deve concluir a extração de detalhe antes da integração do drawer no Cliente 360.
- US3 depende apenas do shell de drawer; Lista e Timeline podem ser implementadas em paralelo.
- US4 é independente de US2/US3 após os tipos de contexto e pode ser dividida por aba.
- US5 deve integrar depois que os fluxos de ação usados estiverem estáveis, mas o teste/configuração de grupos pode começar antes.
- Phase 7 exige todas as fatias incluídas no incremento.

## Terra implementation strategy

1. Implementar US1 em um commit lógico.
2. Implementar US2 como MVP do cockpit e validar com dois clientes.
3. Implementar US3, mantendo cada visão em componente separado.
4. Implementar US4 por aba, medindo antes de qualquer otimização de persistência.
5. Implementar US5 sem alterar ids existentes de aba.
6. Parar e abrir SPEC_DEVIATION se surgir necessidade de migration, novo estado persistido de preventiva ou mudança de autorização.
