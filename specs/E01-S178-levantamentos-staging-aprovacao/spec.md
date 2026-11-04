# Feature Specification: Levantamentos de planilha/Auvo e aprovação PCM em staging

**Story:** E01-S178 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S178-levantamentos`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-012, SSO-021) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Receber e conferir sem alterar estrutura oficial (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Importar lote com Área/Local/Sublocal/Sistema/Componentes/Grupo e tarefa Auvo de levantamento com fotos; repetir e corrigir uma linha.

**Acceptance Scenarios:**

- **AC-1:** Dada planilha padronizada, quando receber, então staging lista campos faltantes, códigos inválidos, duplicidades, vínculos ausentes, hierarquia inconsistente e linhas novas/alteradas/rejeitadas antes de gravar estrutura oficial.
- **AC-2:** Dado levantamento Auvo provisório por tarefa/questionário padronizado, quando receber, então preserva respostas/fotos/origem como pendentes e reentrega não duplica; texto corrido não cria cadastro definitivo nem depende de interpretação automática.
- **AC-3:** Dado contrato futuro Campo, quando receber payload tipado com fotos/quantidades/observações, então usa mesma conferência; permite Local/Sistema provisório sem inventar código definitivo e coleta não é bloqueada por classificação incerta.

### US2 — Aprovar parcial e incorporar com identidade segura (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** PCM aprova três de cinco linhas, rejeita pai de uma, corrige classificação e repete comando; outra sessão tenta aprovar versão antiga.

**Acceptance Scenarios:**

- **AC-4:** Dado lote em conferência, quando PCM autorizado aprovar, então valida localização/classificação/vínculo/duplicidade separadamente, reserva códigos e só então incorpora às tabelas oficiais; acesso sem capacidade é negado.
- **AC-5:** Dado pai rejeitado ou referência pendente, quando aprovar parcial, então dependentes não entram silenciosamente; linhas válidas aprovadas permanecem e retorno mantém fotos, motivo e histórico.
- **AC-6:** Dadas aprovações concorrentes/retry/lote corrigido, quando processar, então revisão obsoleta conflita, mesmo registro não duplica e mudanças são rastreadas por lote/linha; reversão não apaga dependência operacional posterior.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Receber e conferir sem alterar estrutura oficial, conforme AC-1, AC-2, AC-3.
- **FR-002:** Aprovar parcial e incorporar com identidade segura, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Levantamento contém lote, linhas, referências e evidências recebidos em conferência. Decisão PCM valida Local, classificação, vínculos, duplicidades e código. Estrutura oficial só incorpora conteúdo aprovado.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Importar lote com Área/Local/Sublocal/Sistema/Componentes/Grupo e tarefa Auvo de levantamento com fotos; repetir e corrigir uma linha.

## Assumptions & Dependencies

Requer contratos implementados de E01-S176, E01-S177, E01-S170. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Construir aplicativo Copiloto Técnico, offline ou perfil técnico SO; interpretar automaticamente prosa ambígua; escrever cadastro definitivo na recepção. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-030. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
