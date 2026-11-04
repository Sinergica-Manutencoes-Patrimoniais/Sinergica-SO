# Feature Specification: Migração auditável, pilotos por ondas e homologação do programa

**Story:** E01-S186 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S186-migracao-programa`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-021) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Migrar por prévia e lotes reexecutáveis (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Em base de teste, migrar planos para versão1, relações Chamado/OS, agenda e achados; reexecutar lote e reverter logicamente um sem uso posterior.

**Acceptance Scenarios:**

- **AC-1:** Dados legados, quando simular, então relatório separa novos/alterados/duplicidades/erros/ambíguos com contagens e mapping; nenhuma OS é vinculada a Visita só por proximidade temporal.
- **AC-2:** Dado aceite da prévia, quando migrar em teste, então preserva UUIDs/códigos/IDs Auvo/histórico, converte plano simples em versão1 sem reescrever ocorrência passada e remove dependência singular somente após leitores/escritores compatíveis.
- **AC-3:** Dado mesmo lote repetido, quando reexecutar, então contagens são iguais e não duplica; rollback lógico identifica dependência posterior e mantém pendência de reconciliação em vez de apagar execução/financeiro.

### US2 — Homologar ondas sem declarar entrega antecipada (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Executar CT001–030 em ambiente de teste e registrar ressalva; simular saída de onda recusada por evidência faltante.

**Acceptance Scenarios:**

- **AC-4:** Dadas ondas Guainumbí estrutura e depois Chamado/Visita/T24, quando homologar, então exige árvore/busca sem duplicidade e CT001–011 com evidências; Rimini/I Home comprovam Plano/versionamento/calendário e tempos pendentes explícitos.
- **AC-5:** Dadas ondas Pendência/Backlog/campo, Materiais/orçamento e A Faturar/Portal/permissões, quando avaliar, então CT016–030 e segurança/duplicidade são registrados; cliente adicional e geração real dependem liberação Fabrício.
- **AC-6:** Dada matriz CT completa e gates CI, quando registrar conclusão, então inclui versão/ambiente/executor/data/IDs/resultados/capturas/logs e aceite funcional/ressalvas; planilhas só saem após equivalência/estabilidade/aceite formal.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Migrar por prévia e lotes reexecutáveis, conforme AC-1, AC-2, AC-3.
- **FR-002:** Homologar ondas sem declarar entrega antecipada, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Lote de migração preserva correspondência entre registros antigos e novos, contagens e reversão lógica. Evidência de teste registra ambiente/versão/executor/data e resultado. Aceite de onda autoriza avanço operacional explícito.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Em base de teste, migrar planos para versão1, relações Chamado/OS, agenda e achados; reexecutar lote e reverter logicamente um sem uso posterior.

## Assumptions & Dependencies

Requer contratos implementados de E01-S165, E01-S166, E01-S167, E01-S168, E01-S169, E01-S170, E01-S171, E01-S172, E01-S173, E01-S174, E01-S175, E01-S176, E01-S177, E01-S178, E01-S179, E01-S180, E01-S181, E01-S182, E01-S183, E01-S184, E01-S185. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Deploy ou migração real nesta etapa; reconstruir relatório histórico 14/10; desativar planilhas antes de aceite; importar todo histórico Auvo sem escopo. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-001, CT-002, CT-003, CT-004, CT-005, CT-006, CT-007, CT-008, CT-009, CT-010, CT-011, CT-012, CT-013, CT-014, CT-015, CT-016, CT-017, CT-018, CT-019, CT-020, CT-021, CT-022, CT-023, CT-024, CT-025, CT-026, CT-027, CT-028, CT-029, CT-030. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
