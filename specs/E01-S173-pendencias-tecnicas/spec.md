# Feature Specification: Pendências técnicas atômicas, resultados e agrupamento por ativo

**Story:** E01-S173 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S173-pendencias-tecnicas`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-007) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Transformar constatação em pendência rastreável (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Receber execução com três Não OK, um Corrigido, um Não aplicável e obrigatório sem resposta; duplicar evento.

**Acceptance Scenarios:**

- **AC-1:** Dado Não OK explícito não resolvido, quando receber avaliação, então cria/atualiza pendência por origem/pergunta/ativo com Ocorrência, Local, Sistema, checklist, fotos recebidas, executor e data; reentrega não duplica.
- **AC-2:** Dado Corrigido, quando registrar, então guarda evidência sem pendência aberta; Não aplicável preserva justificativa exigida e Não inspecionado é ausência que impede validação quando obrigatório.
- **AC-3:** Dada preventiva integral executada com Não OK, quando PCM validar, então pode concluir preventiva mantendo necessidade corretiva aberta; sem resposta completa não classifica OK por inferência.

### US2 — Consultar e decidir parcialmente por ativo (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Abrir cartão com sete pendências, promover duas, aceitar risco de uma e manter cinco não promovidas rastreáveis.

**Acceptance Scenarios:**

- **AC-4:** Dado ativo com falhas, quando consultar Pendências, então cartão consolida contagem/criticidade e detalhe lista unidades atômicas com evidências, norma, data, estado e histórico; filtros não misturam Clientes.
- **AC-5:** Dadas sete pendências, quando selecionar duas, então somente as duas vão à composição de Backlog e as demais permanecem no banco de Pendências; nenhuma seleção cria Chamado/OS automaticamente.
- **AC-6:** Dada dispensa, duplicidade, risco aceito, resolução ou reabertura, quando PCM autorizado decidir, então exige justificativa, preserva origem/histórico e só resolve condição técnica efetivamente atendida.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Transformar constatação em pendência rastreável, conforme AC-1, AC-2, AC-3.
- **FR-002:** Consultar e decidir parcialmente por ativo, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Pendência técnica é constatação atômica com alvo, origem, Local, evidências, criticidade e condição de resolução. Resposta Corrigido guarda evidência da solução; ausência obrigatória impede validação. Cartão agrega Pendências do mesmo ativo.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Receber execução com três Não OK, um Corrigido, um Não aplicável e obrigatório sem resposta; duplicar evento.

## Assumptions & Dependencies

Requer contratos implementados de E01-S165, E01-S166, E01-S168. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Criar Chamado corretivo automático por Não OK; inferir Não OK de prosa; criar pendência aberta para Corrigido; executar questionário no SO nesta fase. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-016, CT-017, CT-018. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
