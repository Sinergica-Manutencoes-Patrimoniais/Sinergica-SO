# Feature Specification: Backlog canônico e conversões de escopo sem perda

**Story:** E01-S174 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S174-backlog-escopo`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-008) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Priorizar escopo selecionado sem criar execução (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Agrupar duas falhas do ativo, recalcular GUTD e confirmar que fonte e outras cinco falhas permanecem.

**Acceptance Scenarios:**

- **AC-1:** Dadas Pendências selecionadas, quando compor Backlog, então agrupamento é objeto próprio com links às fontes, sem OS/Chamado ainda; seleção concorrente/retry não duplica mesma parcela ativa.
- **AC-2:** Dado backlog, quando priorizar/filtrar, então mantém ranking GUTD existente, filtros por Cliente e escopo; Pendência não selecionada não polui fila.
- **AC-3:** Dado risco aceito ou dispensa, quando decidir com permissão/motivo, então preserva registro/origem e histórico sem marcar execução ou apagar Pendência.

### US2 — Promover e devolver somente restante (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Promover parcialmente um Backlog, executar metade e suspender Chamado; comparar escopo que retorna e abrir painel no Kanban.

**Acceptance Scenarios:**

- **AC-4:** Dado escopo selecionado, quando promover ao Chamado, então preserva IDs/origens e só cria contêiner escolhido; uma requisição repetida retorna mesmo Chamado.
- **AC-5:** Dado Chamado suspenso, quando devolver, então retorna apenas parcela não resolvida à fila ligada, sem perder OS executadas ou duplicar escopo já em tratamento.
- **AC-6:** Dado Kanban ou Cliente 360, quando abrir painel lateral de Backlog, então usa mesmo conjunto Cliente/ranking, mantém contexto/foco e não duplica card de Chamado com OS.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Priorizar escopo selecionado sem criar execução, conforme AC-1, AC-2, AC-3.
- **FR-002:** Promover e devolver somente restante, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Item de Backlog agrupa escopo selecionado e priorização GUTD. Promoção vincula ao Chamado sem apagar fontes. Devolução traz somente parcela não resolvida, mantendo tratamento já executado.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Agrupar duas falhas do ativo, recalcular GUTD e confirmar que fonte e outras cinco falhas permanecem.

## Assumptions & Dependencies

Requer contratos implementados de E01-S173, E01-S167, E01-S170. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Manter fila como status de OS; apagar fonte ao promover; transformar toda pendência em execução. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-018, CT-019. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
