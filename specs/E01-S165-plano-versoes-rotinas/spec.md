# Feature Specification: Plano multialvo, versões de Rotina e questionários referenciados

**Story:** E01-S165 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch:** `codex/handoff-plano-manutencao`
**Status:** Implementação concluída; suíte web e pgTAP integrado passaram, incluindo 183 assertions e a guarda 1824. T016 permanece aberto para CI completa com db-tests, E2E visual, revisão formal e homologação. Não declarar PASS.

**Input:** Caderno Técnico v1 (SSO-006) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Elaborar Plano amplo sem efeito operacional (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Criar Plano Guainumbí com Extintores, QGBT, VRF e Grupo Quantitativo; reabrir rascunho com três Rotinas distintas e nenhum registro de execução criado.

**Acceptance Scenarios:**

- **AC-1:** Dado rascunho do Cliente, quando adicionar vários Sistemas/Componentes/Grupos Quantitativos, então Plano mantém escopo amplo e cada Rotina exige um único alvo inequívoco do mesmo Cliente; seleção de outro Cliente é negada no servidor.
- **AC-2:** Dadas Rotinas mensal e semestral do mesmo alvo, quando salvar e simular, então permanecem independentes com instruções, periodicidades e tempos próprios; salvar, copiar ou importar rascunho não cria Ocorrência operacional, Chamado, OS ou tarefa.
- **AC-3:** Dado tempo vazio ou zero pendente, quando elaborar, então mostra Tempo a validar; duração total de Sistema e por unidade são distintas e capacidade não é declarada validada.

### US2 — Aprovar e revisar com histórico preservado (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Aprovar, copiar modelo, alterar data-base e retirar escopo com efeito futuro; comparar versão e questionário usados por execução antiga.

**Acceptance Scenarios:**

- **AC-4:** Dado Plano em revisão, quando gestor com concessão individual aprovar, então congela conteúdo e registra responsável/data; rascunho incompleto é recusado com erro por Rotina; criador autorizado pode autoaprovar.
- **AC-5:** Dada alteração de âncora, regra, alvo ou questionário de Rotina usada, quando revisar, então cria nova versão com vigência e prévia de ocorrências a manter/alterar e OS abertas, sem mudar snapshot histórico ou conteúdo em execução.
- **AC-6:** Dado modelo ou questionário Auvo referenciado, quando copiar/alterar fonte, então preserva ID, versão e conteúdo recebido do que foi usado; mudança não altera plano aprovado; publicar no Auvo permanece fechado sem prova de API.
- **AC-7:** Dado escopo retirado, suspensão ou encerramento, quando confirmar motivo/vigência, então interrompe geração elegível futura sem cancelar OS automaticamente, preserva consulta passada e retomada encaminha vencidos à decisão PCM.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Elaborar Plano amplo sem efeito operacional, conforme AC-1, AC-2, AC-3.
- **FR-002:** Aprovar e revisar com histórico preservado, conforme AC-4, AC-5, AC-6, AC-7.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Plano agrupa escopo e versões de um Cliente. Rotina tem alvo único, modo, periodicidade, instruções, estimativa e tolerâncias. Versão preserva conteúdo aprovado e questionário aplicado com vigência. Modelo reutilizável é copiado, sem alterar Planos existentes.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Criar Plano Guainumbí com Extintores, QGBT, VRF e Grupo Quantitativo; reabrir rascunho com três Rotinas distintas e nenhum registro de execução criado.

## Assumptions & Dependencies

Requer contratos implementados de E01-S170, E01-S176. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Biblioteca/editoração/publicação de questionários própria e import/export Auvo sem contrato comprovado; geração externa; Copiloto completo. Não executar deploy nem disparos reais no Auvo durante a implementação desta story.

## Traceability

Complementa CT-007/008/009 com versionamento e testes próprios de Plano.. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
