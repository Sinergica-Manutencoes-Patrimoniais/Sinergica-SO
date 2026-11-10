# Feature Specification: Hierarquia técnica, Sistemas distribuídos e Grupos Quantitativos

**Story:** E01-S176 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch:** `codex/handoff-plano-manutencao`
**Status:** Implementação concluída; pgTAP integrado (21 assertions combinadas), suíte web completa e E2E visual isolado (run 42279515409) passaram. T016 permanece aberto para CI completa com db-tests, revisão formal e homologação. Não declarar PASS.

**Input:** Caderno Técnico v1 (SSO-010) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Modelar ativos e grupos preservando estrutura (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Montar VRF com condensadora/evaporadoras/componentes e grupo de 20 luminárias no salão; tentar ciclo e vínculo de outro Cliente.

**Acceptance Scenarios:**

- **AC-1:** Dada árvore Cliente/Área/Local/filhos, quando cadastrar/mover, então preserva níveis flexíveis e separa posição física da composição funcional; mantém nomes UI Componentes/Sistemas e códigos existentes.
- **AC-2:** Dado pai/filho, quando salvar, então exige mesmo Cliente e rejeita ciclo/autoparente no servidor inclusive em concorrência; mantém histórico de movimentação e exclusão lógica.
- **AC-3:** Dado grupo de 20 luminárias homogêneas, quando cadastrar, então é um Grupo por Local com quantidade, características e histórico, sem vinte TAGs ou cadastros remotos individuais.

### US2 — Navegar por Sistema e por Local (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Sistema de Extintores cobre vários halls; mover Componente e consultar Local 360, Sistema 360 e ativo.

**Acceptance Scenarios:**

- **AC-4:** Dado Sistema distribuído, quando compor, então reúne membros de Locais diferentes do mesmo Cliente e cada membro tem no máximo um Sistema vigente; segundo vínculo é rejeitado.
- **AC-5:** Dado Local, quando abrir detalhe, então lista Componentes individuais e Grupos agrupados por Sistema/tipo, com fotos, quantidade, breadcrumb e acesso a histórico.
- **AC-6:** Dado Sistema/ativo, quando abrir detalhe, então mostra árvore funcional, Locais atendidos, composição, identificação, completude, criticidade/atributos técnicos e vínculos de Planos/OS/Pendências já disponíveis; fonte inexistente tem vazio explícito.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Modelar ativos e grupos preservando estrutura, conforme AC-1, AC-2, AC-3.
- **FR-002:** Navegar por Sistema e por Local, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Local representa posição física; Sistema representa função. Componente individual pode ter pai/filhos e no máximo um Sistema vigente. Grupo Quantitativo representa elementos homogêneos por Local sem identificação unitária obrigatória.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Montar VRF com condensadora/evaporadoras/componentes e grupo de 20 luminárias no salão; tentar ciclo e vínculo de outro Cliente.

## Assumptions & Dependencies

Requer contratos implementados de E01-S170. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Renomear tabela pcm.equipamentos; criar árvore física duplicada; forçar torre/pavimento como níveis rígidos; criar Equipment Auvo por luminária de Grupo. Deploy e operações reais no Auvo permanecem fora desta story.

## Traceability

CT-012, CT-013, CT-014. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
