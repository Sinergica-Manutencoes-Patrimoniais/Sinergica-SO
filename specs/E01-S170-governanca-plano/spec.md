# Feature Specification: Permissões por ação e governança configurável do programa

**Story:** E01-S170 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch:** `codex/handoff-plano-manutencao`
**Status:** Implementação, pgTAP integrado (12 assertions), suíte web completa e E2E visual isolado (run 42283953852) passaram. T016 permanece aberto para CI completa com db-tests, revisão formal e homologação. Código escrito não constitui PASS.

**Input:** Caderno Técnico v1 (SSO-019) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Configurar e aplicar capacidades atuais (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Administrador atribui perfis acumuláveis e concessão individual; Operador tenta ação direta sem capacidade e acesso Cliente cruzado.

**Acceptance Scenarios:**

- **AC-1:** Dado usuário com escrita PCM mas sem capacidade crítica, quando chamar ação diretamente, então servidor nega e UI oculta/desabilita; perfil/acesso de módulo isolado não autoriza ação.
- **AC-2:** Dado Administrador, quando conceder/revogar perfil/capacidade por usuário e escopo, então permissões atuais governam novas ações inclusive com sessão antiga; configurações são editáveis e acumuláveis, sem nomes fixos.
- **AC-3:** Dado Cliente, Compras, Comercial, Financeiro, Supervisor e PCM, quando acessar, então cada um vê apenas campos/ações/Clientes autorizados; técnico segue somente Auvo, e custo/margem não aparecem para Cliente.

### US2 — Gerir Plano e validar execução conforme decisão do Fabrício (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Planejador sem/com concessão individual tenta autoaprovar; supervisor autorizado valida OS e consulta auditoria.

**Acceptance Scenarios:**

- **AC-4:** Dado planejador com permissão específica de gestor atribuída individualmente, quando aprovar próprio Plano, suspender/encerrar ou autorizar cancelamento, então ação é permitida e auditada; sem concessão é negada.
- **AC-5:** Dado supervisor ou operador PCM com permissão de validação, quando validar/rejeitar/reabrir execução, então registra decisão, evidências verificadas, observação e motivo de devolução/reabertura.
- **AC-6:** Dada auditoria, quando tentar alterar/excluir evento inclusive com service_role, então operação é negada; ações críticas guardam ator/data/motivo/antes/depois/correlação.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Configurar e aplicar capacidades atuais, conforme AC-1, AC-2, AC-3.
- **FR-002:** Gerir Plano e validar execução conforme decisão do Fabrício, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Capacidade autoriza uma ação em determinado escopo. Perfil/grupo e concessão individual compõem acesso. Decisão de gestão/validação e mudança de permissão têm autoria e histórico imutável.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Administrador atribui perfis acumuláveis e concessão individual; Operador tenta ação direta sem capacidade e acesso Cliente cruzado.

## Assumptions & Dependencies

Pode iniciar isoladamente sobre a base existente. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Identidades hardcoded; criar login técnico SSO; considerar escrita genérica como aprovação/validação automática. Deploy e operações reais no Auvo permanecem fora desta story.

## Traceability

CT-027. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
